package com.unipost.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.domain.outbox.OutboxEvent;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.repository.jpa.OutboxEventRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class OutboxEventPublisherTest {

    private OutboxEventRepository outboxEventRepository;
    private ObjectMapper objectMapper;
    private OutboxEventPublisher publisher;

    @BeforeEach
    void setUp() {
        outboxEventRepository = mock(OutboxEventRepository.class);
        objectMapper = new ObjectMapper();
        publisher = new OutboxEventPublisher(outboxEventRepository, objectMapper);
        when(outboxEventRepository.save(any(OutboxEvent.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void testPublishEventWithActiveTenant() {
        TenantContextHolder.setTenantId("tenant-alpha");

        Map<String, Object> payload = Map.of("title", "Hello World", "slug", "hello-world");
        OutboxEvent event = publisher.publish("article", "art-101", "RECORD_CREATED", payload);

        assertNotNull(event);
        assertNotNull(event.getEventId());
        assertEquals("article", event.getAggregateType());
        assertEquals("art-101", event.getAggregateId());
        assertEquals("RECORD_CREATED", event.getEventType());
        assertEquals("tenant-alpha", event.getTenantId());
        assertEquals("PENDING", event.getStatus());
        assertEquals(0, event.getRetryCount());
        assertEquals(5, event.getMaxRetries());
        assertTrue(event.getPayload().contains("hello-world"));

        ArgumentCaptor<OutboxEvent> captor = ArgumentCaptor.forClass(OutboxEvent.class);
        verify(outboxEventRepository, times(1)).save(captor.capture());
        assertEquals("tenant-alpha", captor.getValue().getTenantId());
    }

    @Test
    void testPublishEventWithDefaultTenantFallback() {
        TenantContextHolder.clear();

        OutboxEvent event = publisher.publish("entity_record", "rec-999", "RECORD_DELETED", Map.of("deleted", true));

        assertNotNull(event);
        assertEquals("DEFAULT", event.getTenantId());
        assertEquals("PENDING", event.getStatus());
        verify(outboxEventRepository).save(any(OutboxEvent.class));
    }

    @Test
    void testPublishEvent_WithStringJsonPayload() {
        String json = "{\"action\":\"export\",\"format\":\"csv\"}";
        OutboxEvent event = publisher.publish("export", "exp-1", "EXPORT_REQUESTED", "tenant-test", json);

        assertNotNull(event);
        assertTrue(event.getPayload().contains("csv"));
        assertEquals("tenant-test", event.getTenantId());
    }

    record SamplePojo(String name, int count) {}

    @Test
    void testPublishEvent_WithPojoPayload() {
        SamplePojo pojo = new SamplePojo("Item", 42);
        OutboxEvent event = publisher.publish("item", "item-1", "ITEM_CREATED", "tenant-test", pojo);

        assertNotNull(event);
        assertTrue(event.getPayload().contains("Item"));
        assertTrue(event.getPayload().contains("42"));
    }

    @Test
    void testPublishEvent_WithMdcTraceId() {
        org.slf4j.MDC.put("trace_id", "4bf92f3577b34da6a3ce929d0e0e4736");
        try {
            OutboxEvent event = publisher.publish("order", "ord-1", "ORDER_PLACED", "tenant-test", Map.of("total", 100));
            assertTrue(event.getPayload().contains("traceparent"));
            assertTrue(event.getPayload().contains("4bf92f3577b34da6a3ce929d0e0e4736"));
        } finally {
            org.slf4j.MDC.clear();
        }
    }

    @Test
    void testPublishEvent_WithMdcTraceIdCamelCase() {
        org.slf4j.MDC.put("traceId", "abcdef1234567890abcdef1234567890");
        try {
            OutboxEvent event = publisher.publish("order", "ord-2", "ORDER_PLACED", "tenant-test", Map.of("total", 200));
            assertTrue(event.getPayload().contains("traceparent"));
            assertTrue(event.getPayload().contains("abcdef1234567890abcdef1234567890"));
        } finally {
            org.slf4j.MDC.clear();
        }
    }

    @Test
    void testPublishEvent_WithExistingTraceparent_DoesNotOverwrite() {
        org.slf4j.MDC.put("trace_id", "11111111111111111111111111111111");
        try {
            Map<String, Object> payload = Map.of("traceparent", "00-existing-traceparent-01");
            OutboxEvent event = publisher.publish("order", "ord-3", "ORDER_PLACED", "tenant-test", payload);
            assertTrue(event.getPayload().contains("00-existing-traceparent-01"));
        } finally {
            org.slf4j.MDC.clear();
        }
    }

    @Test
    void testPublishEvent_SerializationFailureFallback() {
        // String that is not valid JSON
        OutboxEvent event = publisher.publish("raw", "raw-1", "RAW_EVENT", "tenant-test", "not a json string");
        assertNotNull(event);
        assertEquals("not a json string", event.getPayload());

        // Object that fails serialization fallback
        Object nonSerializable = new Object() {
            public Object getSelf() { throw new RuntimeException("fail"); }
        };
        OutboxEvent event2 = publisher.publish("raw", "raw-2", "RAW_EVENT", "tenant-test", nonSerializable);
        assertNotNull(event2);
        assertEquals("{}", event2.getPayload());
    }
}
