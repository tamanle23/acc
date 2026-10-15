package com.unipost.aio.controller.workflow;

import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Component
public class ExecutionStreamBroadcaster {

    private final Map<String, List<SseEmitter>> executionEmitters = new ConcurrentHashMap<>();

    public SseEmitter register(String executionId, long timeoutMs) {
        SseEmitter emitter = new SseEmitter(timeoutMs);
        executionEmitters.computeIfAbsent(executionId, k -> new CopyOnWriteArrayList<>()).add(emitter);

        emitter.onCompletion(() -> removeEmitter(executionId, emitter));
        emitter.onTimeout(() -> removeEmitter(executionId, emitter));
        emitter.onError((ex) -> removeEmitter(executionId, emitter));

        // Send initial connected ping
        try {
            emitter.send(SseEmitter.event()
                .name("CONNECTED")
                .data(Map.of("executionId", executionId, "status", "CONNECTED", "timestamp", System.currentTimeMillis())));
        } catch (IOException e) {
            removeEmitter(executionId, emitter);
        }

        return emitter;
    }

    public void broadcast(String executionId, String eventType, Map<String, Object> payload) {
        List<SseEmitter> emitters = executionEmitters.get(executionId);
        if (emitters == null || emitters.isEmpty()) {
            return;
        }

        List<SseEmitter> deadEmitters = new CopyOnWriteArrayList<>();
        for (SseEmitter emitter : emitters) {
            try {
                emitter.send(SseEmitter.event()
                    .name(eventType)
                    .data(payload));
            } catch (Exception e) {
                deadEmitters.add(emitter);
            }
        }

        if (!deadEmitters.isEmpty()) {
            emitters.removeAll(deadEmitters);
            if (emitters.isEmpty()) {
                executionEmitters.remove(executionId);
            }
        }
    }

    private void removeEmitter(String executionId, SseEmitter emitter) {
        List<SseEmitter> emitters = executionEmitters.get(executionId);
        if (emitters != null) {
            emitters.remove(emitter);
            if (emitters.isEmpty()) {
                executionEmitters.remove(executionId);
            }
        }
    }
}
