package com.acc.worker.application.outbox.ports.out;

/**
 * Secondary Driven Port (SPI) for dispatching edge webhooks and notifications.
 */
public interface WebhookTransportPort {

    boolean triggerEdgeRevalidation(String slug, String tag, String traceparent);
}
