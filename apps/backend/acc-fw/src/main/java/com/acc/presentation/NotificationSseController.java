package com.acc.presentation;

import com.acc.fw.tenancy.TenantContextHolder;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Server-Sent Events (SSE) notification streaming controller.
 * Exposes /api/v1/notifications/stream for real-time approvals, workflow alerts, and entity CDC updates.
 */
@Slf4j
@RestController
public class NotificationSseController {

    private static final Long DEFAULT_TIMEOUT_MS = 300_000L; // 5 minutes
    private final Map<String, List<SseEmitter>> tenantEmitters = new ConcurrentHashMap<>();

    @GetMapping(value = "/api/v1/notifications/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter streamNotifications(@RequestParam(required = false) String tenantId) {
        String activeTenantId = (tenantId != null && !tenantId.isBlank())
                ? tenantId
                : TenantContextHolder.getTenantId();

        if (activeTenantId == null || activeTenantId.isBlank()) {
            activeTenantId = "DEFAULT";
        }

        SseEmitter emitter = new SseEmitter(DEFAULT_TIMEOUT_MS);
        String finalTenantId = activeTenantId;

        List<SseEmitter> emitters = tenantEmitters.computeIfAbsent(finalTenantId, k -> new CopyOnWriteArrayList<>());
        emitters.add(emitter);

        emitter.onCompletion(() -> removeEmitter(finalTenantId, emitter));
        emitter.onTimeout(() -> removeEmitter(finalTenantId, emitter));
        emitter.onError(e -> removeEmitter(finalTenantId, emitter));

        try {
            // Initial handshake event
            emitter.send(SseEmitter.event()
                    .name("INIT")
                    .data(Map.of(
                            "status", "CONNECTED",
                            "tenantId", finalTenantId,
                            "timestamp", System.currentTimeMillis()
                    )));
        } catch (IOException e) {
            removeEmitter(finalTenantId, emitter);
        }

        return emitter;
    }

    public void broadcast(String tenantId, String eventName, Object payload) {
        if (tenantId == null) tenantId = "DEFAULT";
        List<SseEmitter> emitters = tenantEmitters.get(tenantId);
        if (emitters != null && !emitters.isEmpty()) {
            for (SseEmitter emitter : emitters) {
                try {
                    emitter.send(SseEmitter.event()
                            .name(eventName)
                            .data(payload));
                } catch (Exception e) {
                    removeEmitter(tenantId, emitter);
                }
            }
        }

        // Also broadcast to SYSTEM tenant listeners if not already SYSTEM
        if (!"SYSTEM".equalsIgnoreCase(tenantId)) {
            List<SseEmitter> systemEmitters = tenantEmitters.get("SYSTEM");
            if (systemEmitters != null && !systemEmitters.isEmpty()) {
                for (SseEmitter emitter : systemEmitters) {
                    try {
                        emitter.send(SseEmitter.event()
                                .name(eventName)
                                .data(payload));
                    } catch (Exception e) {
                        removeEmitter("SYSTEM", emitter);
                    }
                }
            }
        }
    }

    @Scheduled(fixedRate = 30000)
    public void sendHeartbeat() {
        for (Map.Entry<String, List<SseEmitter>> entry : tenantEmitters.entrySet()) {
            String tenantId = entry.getKey();
            for (SseEmitter emitter : entry.getValue()) {
                try {
                    emitter.send(SseEmitter.event().comment("ping"));
                } catch (Exception e) {
                    removeEmitter(tenantId, emitter);
                }
            }
        }
    }

    private void removeEmitter(String tenantId, SseEmitter emitter) {
        List<SseEmitter> emitters = tenantEmitters.get(tenantId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                tenantEmitters.remove(tenantId);
            }
        }
    }

    public int getActiveConnectionCount(String tenantId) {
        List<SseEmitter> emitters = tenantEmitters.get(tenantId);
        return emitters != null ? emitters.size() : 0;
    }
}
