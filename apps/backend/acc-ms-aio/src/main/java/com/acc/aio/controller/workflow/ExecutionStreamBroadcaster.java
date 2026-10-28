package com.acc.aio.controller.workflow;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Component
public class ExecutionStreamBroadcaster {

    private static final Logger log = LoggerFactory.getLogger(ExecutionStreamBroadcaster.class);

    private static final int MAX_EMITTERS_PER_EXECUTION = 100;
    private final Map<String, List<SseEmitter>> executionEmitters = new ConcurrentHashMap<>();
    private final ExecutorService virtualThreadExecutor = createAsyncExecutor();

    private static ExecutorService createAsyncExecutor() {
        try {
            // Reflectively initialize Java 21+ Loom virtual thread executor if available on runtime
            var method = Executors.class.getMethod("newVirtualThreadPerTaskExecutor");
            return (ExecutorService) method.invoke(null);
        } catch (Exception e) {
            log.info("Loom virtual threads not available on current JVM ({}), falling back to cached executor", System.getProperty("java.version"));
            return Executors.newCachedThreadPool();
        }
    }

    public SseEmitter register(String executionId, long timeoutMs) {
        SseEmitter emitter = new SseEmitter(timeoutMs);
        List<SseEmitter> emitters = executionEmitters.computeIfAbsent(executionId, k -> new CopyOnWriteArrayList<>());
        while (emitters.size() >= MAX_EMITTERS_PER_EXECUTION) {
            SseEmitter oldest = emitters.remove(0);
            try {
                oldest.complete();
            } catch (Exception ignored) {}
        }
        emitters.add(emitter);

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

        // Dispatch via Java 21 Loom virtual threads to avoid blocking caller thread
        virtualThreadExecutor.submit(() -> {
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
        });
    }

    public void broadcastTaskLog(String executionId, String taskId, String taskReferenceName, String level, String message, Object raw) {
        long now = System.currentTimeMillis();
        Map<String, Object> payload = new java.util.LinkedHashMap<>();
        payload.put("executionId", executionId);
        payload.put("taskId", taskId);
        payload.put("taskReferenceName", taskReferenceName);
        payload.put("level", level != null ? level : "INFO");
        payload.put("message", message != null ? message : "");
        if (raw != null) {
            payload.put("raw", raw);
        }
        payload.put("timestamp", now);

        broadcast(executionId, "TASK_LOG", payload);
    }

    /**
     * Periodic 15-second heartbeat ping to prevent TCP, proxy, and browser EventSource timeouts.
     */
    @Scheduled(fixedRate = 15000)
    public void sendHeartbeat() {
        if (executionEmitters.isEmpty()) {
            return;
        }

        long now = System.currentTimeMillis();
        Map<String, Object> pingData = Map.of("ping", true, "timestamp", now);

        for (String executionId : executionEmitters.keySet()) {
            broadcast(executionId, "HEARTBEAT", pingData);
        }
    }

    public int getActiveClientCount(String executionId) {
        List<SseEmitter> list = executionEmitters.get(executionId);
        return list != null ? list.size() : 0;
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

