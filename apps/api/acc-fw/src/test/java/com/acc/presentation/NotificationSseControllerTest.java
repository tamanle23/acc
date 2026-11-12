package com.acc.presentation;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class NotificationSseControllerTest {

    private NotificationSseController controller;

    @BeforeEach
    void setUp() {
        controller = new NotificationSseController();
    }

    @Test
    void testStreamNotifications_ReturnsEmitterAndIncrementsCount() {
        SseEmitter emitter = controller.streamNotifications("tenant-alpha");

        assertNotNull(emitter);
        assertEquals(1, controller.getActiveConnectionCount("tenant-alpha"));
    }

    @Test
    void testStreamNotifications_DefaultTenantWhenNullOrBlank() {
        SseEmitter emitter1 = controller.streamNotifications(null);
        SseEmitter emitter2 = controller.streamNotifications("  ");

        assertNotNull(emitter1);
        assertNotNull(emitter2);
        assertEquals(2, controller.getActiveConnectionCount("DEFAULT"));
    }

    @Test
    void testBroadcast_DeliversToTargetTenantAndSystem() {
        controller.streamNotifications("tenant-alpha");
        controller.streamNotifications("SYSTEM");

        assertEquals(1, controller.getActiveConnectionCount("tenant-alpha"));
        assertEquals(1, controller.getActiveConnectionCount("SYSTEM"));

        // Should broadcast to both tenant-alpha and SYSTEM without throwing exceptions
        assertDoesNotThrow(() ->
                controller.broadcast("tenant-alpha", "ENTITY_MUTATED", Map.of("recordId", 123L))
        );
    }

    @Test
    void testSendHeartbeat_RunsWithoutErrors() {
        controller.streamNotifications("tenant-alpha");
        assertDoesNotThrow(() -> controller.sendHeartbeat());
    }

    @Test
    void testEmitterCompletion_RemovesFromActiveConnectionsOnHeartbeat() {
        SseEmitter emitter = controller.streamNotifications("tenant-temp");
        assertEquals(1, controller.getActiveConnectionCount("tenant-temp"));

        emitter.complete();
        controller.sendHeartbeat();
        assertEquals(0, controller.getActiveConnectionCount("tenant-temp"));
    }
}
