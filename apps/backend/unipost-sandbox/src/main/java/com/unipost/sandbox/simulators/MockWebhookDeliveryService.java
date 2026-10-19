package com.unipost.sandbox.simulators;

import com.unipost.worker.service.WebhookDeliveryService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.util.Map;

/**
 * Drop-in primary WebhookDeliveryService bean for unipost-ms-worker.
 * Activated strictly when application.sandbox.enabled=true.
 * Intercepts outbound edge invalidations and webhooks, recording them in MockWebhookDispatcher
 * and returning HTTP 200 success so OutboxPollingJob marks events as DELIVERED without network errors.
 */
@Service
@Primary
@ConditionalOnClass(name = "com.unipost.worker.service.WebhookDeliveryService")
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class MockWebhookDeliveryService extends WebhookDeliveryService {

    private static final Logger log = LoggerFactory.getLogger(MockWebhookDeliveryService.class);

    private final MockWebhookDispatcher dispatcher;

    public MockWebhookDeliveryService(MockWebhookDispatcher dispatcher) {
        super();
        this.dispatcher = dispatcher;
        log.info("MockWebhookDeliveryService activated as @Primary WebhookDeliveryService bean for sandbox.");
    }

    @Override
    public boolean triggerEdgeRevalidation(String slug, String tag, String traceparent) {
        log.info("[Sandbox Webhook Delivery] Intercepted edge revalidation for slug: {}, tag: {}", slug, tag);
        dispatcher.dispatch(
                "http://sandbox-tekgo/api/revalidate",
                "EDGE_REVALIDATION",
                String.format("{\"slug\":\"%s\",\"tag\":\"%s\"}", slug, tag),
                traceparent != null ? Map.of("traceparent", traceparent) : Map.of()
        );
        return true;
    }
}
