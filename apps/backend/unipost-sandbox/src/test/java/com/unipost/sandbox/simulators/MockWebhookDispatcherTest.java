package com.unipost.sandbox.simulators;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class MockWebhookDispatcherTest {

    private MockWebhookDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new MockWebhookDispatcher();
    }

    @Test
    @DisplayName("Should capture dispatched webhooks in memory")
    void shouldCaptureWebhooks() {
        dispatcher.dispatch(
                "http://example.com/webhook",
                "ENTITY_CREATED",
                "{\"id\":\"rec-1\"}",
                Map.of("Authorization", "Bearer test")
        );

        List<MockWebhookDispatcher.DispatchedWebhook> events = dispatcher.getCapturedEvents();
        assertEquals(1, events.size());
        assertEquals("http://example.com/webhook", events.get(0).targetUrl());
        assertEquals("ENTITY_CREATED", events.get(0).eventType());
        assertEquals("{\"id\":\"rec-1\"}", events.get(0).payload());
    }

    @Test
    @DisplayName("Should filter captured webhooks by event type")
    void shouldFilterByEventType() {
        dispatcher.dispatch("http://a.com", "TYPE_A", "payload-1", Map.of());
        dispatcher.dispatch("http://b.com", "TYPE_B", "payload-2", Map.of());
        dispatcher.dispatch("http://c.com", "TYPE_A", "payload-3", Map.of());

        List<MockWebhookDispatcher.DispatchedWebhook> typeAEvents = dispatcher.findByEventType("TYPE_A");
        assertEquals(2, typeAEvents.size());

        List<MockWebhookDispatcher.DispatchedWebhook> typeBEvents = dispatcher.findByEventType("TYPE_B");
        assertEquals(1, typeBEvents.size());
    }

    @Test
    @DisplayName("Should clear all captured events on reset")
    void shouldClearOnReset() {
        dispatcher.dispatch("http://a.com", "EVT", "{}", Map.of());
        assertEquals(1, dispatcher.getCapturedEvents().size());

        dispatcher.reset();
        assertEquals(0, dispatcher.getCapturedEvents().size());
    }
}
