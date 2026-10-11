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
}
