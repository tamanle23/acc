package com.unipost.worker.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.domain.outbox.OutboxEvent;
import com.unipost.repository.jpa.OutboxEventRepository;
import com.unipost.worker.service.WebhookDeliveryService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

class OutboxPollingJobTest {

    private OutboxEventRepository outboxEventRepository;
    private WebhookDeliveryService webhookDeliveryService;
    private ObjectMapper objectMapper;
    private OutboxPollingJob outboxPollingJob;

    @BeforeEach
    void setUp() {
        outboxEventRepository = mock(OutboxEventRepository.class);
        webhookDeliveryService = mock(WebhookDeliveryService.class);
        objectMapper = new ObjectMapper();
        outboxPollingJob = new OutboxPollingJob(outboxEventRepository, webhookDeliveryService, objectMapper);
    }

    @Test
    void testProcessBatchSuccess() {
        OutboxEvent event = new OutboxEvent();
        event.setEventId("evt-1");
        event.setAggregateType("article");
        event.setAggregateId("art-1");
        event.setEventType("RECORD_CREATED");
        event.setPayload("{\"title\":\"Tech Article\",\"slug\":\"tech-article\",\"category\":\"news\"}");
        event.setStatus("PENDING");
        event.setRetryCount(0);
        event.setMaxRetries(5);

        when(outboxEventRepository.findPendingEventsForProcessing(50)).thenReturn(List.of(event));
        when(webhookDeliveryService.triggerEdgeRevalidation(eq("tech-article"), eq("news"), any())).thenReturn(true);

        int processed = outboxPollingJob.processBatch();

        assertEquals(1, processed);
        assertEquals("PUBLISHED", event.getStatus());
        assertNotNull(event.getProcessedAt());
        assertNull(event.getLastError());
        verify(outboxEventRepository).save(event);
        verify(webhookDeliveryService).triggerEdgeRevalidation(eq("tech-article"), eq("news"), any());
    }

    @Test
    void testProcessBatchRetryWithBackoff() {
        OutboxEvent event = new OutboxEvent();
        event.setEventId("evt-2");
        event.setAggregateType("article");
        event.setAggregateId("art-2");
        event.setEventType("RECORD_UPDATED");
        event.setPayload("{\"title\":\"Failing Article\",\"slug\":\"failing-slug\"}");
        event.setStatus("PENDING");
        event.setRetryCount(1);
        event.setMaxRetries(5);

        when(outboxEventRepository.findPendingEventsForProcessing(50)).thenReturn(List.of(event));
        when(webhookDeliveryService.triggerEdgeRevalidation(eq("failing-slug"), any(), any())).thenReturn(false);

        int processed = outboxPollingJob.processBatch();

        assertEquals(1, processed);
        assertEquals("PENDING", event.getStatus());
        assertEquals(2, event.getRetryCount());
        assertNotNull(event.getNextRetryAt());
        assertNotNull(event.getLastError());
        verify(outboxEventRepository).save(event);
    }

    @Test
    void testProcessBatchDeadLetterWhenMaxRetriesExceeded() {
        OutboxEvent event = new OutboxEvent();
        event.setEventId("evt-3");
        event.setAggregateType("article");
        event.setAggregateId("art-3");
        event.setEventType("RECORD_UPDATED");
        event.setPayload("{\"title\":\"Broken Article\",\"slug\":\"broken-slug\"}");
        event.setStatus("PENDING");
        event.setRetryCount(4);
        event.setMaxRetries(5);

        when(outboxEventRepository.findPendingEventsForProcessing(50)).thenReturn(List.of(event));
        when(webhookDeliveryService.triggerEdgeRevalidation(eq("broken-slug"), any(), any())).thenReturn(false);

        int processed = outboxPollingJob.processBatch();

        assertEquals(1, processed);
        assertEquals("DEAD_LETTER", event.getStatus());
        assertEquals(5, event.getRetryCount());
        verify(outboxEventRepository).save(event);
    }

    @Test
    void testProcessBatchSkipsFutureRetryThreshold() {
        OutboxEvent event = new OutboxEvent();
        event.setEventId("evt-4");
        event.setStatus("PENDING");
        event.setNextRetryAt(LocalDateTime.now().plusMinutes(5));

        when(outboxEventRepository.findPendingEventsForProcessing(50)).thenReturn(List.of(event));

        int processed = outboxPollingJob.processBatch();

        assertEquals(1, processed);
        // Should not have dispatched or saved
        verify(webhookDeliveryService, never()).triggerEdgeRevalidation(any(), any(), any());
        verify(outboxEventRepository, never()).save(event);
    }
}
