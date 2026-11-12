package com.acc.worker.infrastructure.adapters.outbound.transport;

import com.acc.worker.application.outbox.ports.out.WebhookTransportPort;
import com.acc.worker.service.WebhookDeliveryService;
import org.springframework.stereotype.Component;

/**
 * Secondary Driven Adapter dispatching edge revalidation webhooks via WebhookDeliveryService.
 */
@Component
public class HttpWebhookTransportAdapter implements WebhookTransportPort {

    private final WebhookDeliveryService webhookDeliveryService;

    public HttpWebhookTransportAdapter(WebhookDeliveryService webhookDeliveryService) {
        this.webhookDeliveryService = webhookDeliveryService;
    }

    @Override
    public boolean triggerEdgeRevalidation(String slug, String tag, String traceparent) {
        return webhookDeliveryService.triggerEdgeRevalidation(slug, tag, traceparent);
    }
}
