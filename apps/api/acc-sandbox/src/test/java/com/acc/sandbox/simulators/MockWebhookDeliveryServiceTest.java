package com.acc.sandbox.simulators;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class MockWebhookDeliveryServiceTest {

    private MockWebhookDeliveryService deliveryService;
    private MockWebhookDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new MockWebhookDispatcher();
        deliveryService = new MockWebhookDeliveryService(dispatcher);
    }

    @Test
    @DisplayName("Should intercept edge revalidation and record in dispatcher without network traffic")
    void shouldInterceptEdgeRevalidation() {
        boolean success = deliveryService.triggerEdgeRevalidation("article-alpha", "news", "trace-123");
        assertTrue(success);

        List<MockWebhookDispatcher.DispatchedWebhook> events = dispatcher.getCapturedEvents();
        assertEquals(1, events.size());
        assertEquals("EDGE_REVALIDATION", events.get(0).eventType());
        assertTrue(events.get(0).payload().contains("article-alpha"));
        assertEquals("trace-123", events.get(0).headers().get("traceparent"));
    }
}
