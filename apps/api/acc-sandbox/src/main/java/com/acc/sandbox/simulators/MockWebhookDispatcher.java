package com.acc.sandbox.simulators;

import com.acc.sandbox.spi.ExternalServiceSimulator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Mock dispatcher for Outbox and Webhook events.
 * Intercepts outbound webhooks and retains them in memory,
 * preventing connection timeouts to un-hosted external third parties during dev and test.
 */
@Component
public class MockWebhookDispatcher implements ExternalServiceSimulator {

    private static final Logger log = LoggerFactory.getLogger(MockWebhookDispatcher.class);

    public record DispatchedWebhook(
            String id,
            String targetUrl,
            String eventType,
            String payload,
            Map<String, String> headers,
            LocalDateTime dispatchedAt
    ) {}

    private final List<DispatchedWebhook> capturedEvents = new CopyOnWriteArrayList<>();

    @Override
    public String getId() {
        return "mock-webhook";
    }

    @Override
    public String getName() {
        return "Outbox Webhook Dispatcher Simulator";
    }

    @Override
    public void reset() {
        capturedEvents.clear();
        log.info("MockWebhookDispatcher state reset.");
    }

    @Override
    public Map<String, Object> getDiagnostics() {
        return Map.of(
                "capturedCount", capturedEvents.size(),
                "recentEvents", capturedEvents.stream().limit(5).map(DispatchedWebhook::eventType).toList()
        );
    }

    public void dispatch(String targetUrl, String eventType, String payload, Map<String, String> headers) {
        String id = UUID.randomUUID().toString();
        DispatchedWebhook event = new DispatchedWebhook(id, targetUrl, eventType, payload, headers != null ? headers : Map.of(), LocalDateTime.now());
        capturedEvents.add(event);
        log.debug("Simulated webhook dispatched: id={}, type={}, url={}", id, eventType, targetUrl);
    }

    public List<DispatchedWebhook> getCapturedEvents() {
        return Collections.unmodifiableList(capturedEvents);
    }

    public List<DispatchedWebhook> findByEventType(String eventType) {
        return capturedEvents.stream().filter(e -> Objects.equals(e.eventType(), eventType)).toList();
    }
}
