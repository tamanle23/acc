package com.acc.worker.application.outbox;

import com.acc.worker.application.outbox.ports.out.WebhookTransportPort;
import com.acc.worker.application.outbox.service.ProcessOutboxQueueApplicationService;
import com.acc.worker.domain.outbox.model.OutboxMessageAggregate;
import com.acc.worker.domain.outbox.repository.OutboxRepositoryPort;
import com.acc.worker.domain.outbox.valobj.OutboxStatus;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@DisplayName("ProcessOutboxQueueApplicationService Unit Tests")
class ProcessOutboxQueueApplicationServiceTest {

    private OutboxRepositoryPort outboxRepositoryPort;
    private WebhookTransportPort webhookTransportPort;
    private ObjectMapper objectMapper;
    private ProcessOutboxQueueApplicationService applicationService;

    @BeforeEach
    void setUp() {
        outboxRepositoryPort = mock(OutboxRepositoryPort.class);
        webhookTransportPort = mock(WebhookTransportPort.class);
        objectMapper = new ObjectMapper();
        applicationService = new ProcessOutboxQueueApplicationService(outboxRepositoryPort, webhookTransportPort, objectMapper);
    }

    @Test
    @DisplayName("processBatch publishes eligible message when transport succeeds")
    void testProcessBatchSuccess() {
        long now = 1000000L;
        OutboxMessageAggregate message = OutboxMessageAggregate.createNew(
            "ARTICLE_PUBLISHED", "article", "art-1", "tenant-1",
            "{\"slug\":\"test-article\",\"category\":\"tech\",\"traceparent\":\"00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\"}",
            now
        );

        when(outboxRepositoryPort.findPendingMessages(50)).thenReturn(List.of(message));
        when(webhookTransportPort.triggerEdgeRevalidation(eq("test-article"), eq("tech"), any())).thenReturn(true);

        int processed = applicationService.processBatch(50, now);

        assertEquals(1, processed);
        assertEquals(OutboxStatus.PUBLISHED, message.status());
        assertNotNull(message.processedAtEpochMs());
        verify(webhookTransportPort).triggerEdgeRevalidation(eq("test-article"), eq("tech"), any());
        verify(outboxRepositoryPort).save(message);
    }

    @Test
    @DisplayName("processBatch records failure and exponential backoff when transport fails")
    void testProcessBatchFailure() {
        long now = 1000000L;
        OutboxMessageAggregate message = OutboxMessageAggregate.createNew(
            "ARTICLE_PUBLISHED", "article", "art-2", "tenant-1",
            "{\"slug\":\"failing-article\"}",
            now
        );

        when(outboxRepositoryPort.findPendingMessages(50)).thenReturn(List.of(message));
        when(webhookTransportPort.triggerEdgeRevalidation(eq("failing-article"), any(), any())).thenReturn(false);

        int processed = applicationService.processBatch(50, now);

        assertEquals(1, processed);
        assertEquals(OutboxStatus.PENDING, message.status());
        assertEquals(1, message.retryCount());
        assertNotNull(message.nextRetryAtEpochMs());
        verify(outboxRepositoryPort).save(message);
    }
}
