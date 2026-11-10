package com.acc.worker.domain.outbox;

import com.acc.worker.domain.outbox.model.OutboxMessageAggregate;
import com.acc.worker.domain.outbox.valobj.OutboxMessageId;
import com.acc.worker.domain.outbox.valobj.OutboxStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

@DisplayName("OutboxMessageAggregate Pure Domain Tests")
class OutboxMessageAggregateTest {

    @Test
    @DisplayName("createNew initializes aggregate in PENDING status with zero retries")
    void testCreateNew() {
        long now = 1000000L;
        OutboxMessageAggregate message = OutboxMessageAggregate.createNew(
            "ARTICLE_PUBLISHED",
            "article",
            "art-123",
            "tenant-alpha",
            "{\"slug\":\"hello-world\"}",
            now
        );

        assertNotNull(message.getId());
        assertEquals("ARTICLE_PUBLISHED", message.eventType());
        assertEquals("article", message.aggregateType());
        assertEquals("art-123", message.aggregateId());
        assertEquals("tenant-alpha", message.tenantId());
        assertEquals(OutboxStatus.PENDING, message.status());
        assertEquals(0, message.retryCount());
        assertEquals(5, message.maxRetries());
        assertNull(message.lastError());
        assertNull(message.nextRetryAtEpochMs());
        assertNull(message.processedAtEpochMs());
        assertTrue(message.isEligibleForProcessing(now));
    }

    @Test
    @DisplayName("markPublished updates status to PUBLISHED and sets processedAt")
    void testMarkPublished() {
        long now = 1000000L;
        OutboxMessageAggregate message = OutboxMessageAggregate.createNew(
            "ARTICLE_PUBLISHED", "article", "art-1", "tenant-1", "{}", now
        );

        long publishTime = now + 5000L;
        message.markPublished(publishTime);

        assertEquals(OutboxStatus.PUBLISHED, message.status());
        assertEquals(publishTime, message.processedAtEpochMs());
        assertNull(message.lastError());
        assertFalse(message.isEligibleForProcessing(publishTime + 1000L));
    }

    @Test
    @DisplayName("recordFailure increments retryCount and calculates exponential backoff")
    void testRecordFailureExponentialBackoff() {
        long now = 1000000L;
        OutboxMessageAggregate message = OutboxMessageAggregate.createNew(
            "ARTICLE_PUBLISHED", "article", "art-1", "tenant-1", "{}", now
        );

        message.recordFailure("Connection timed out", now);

        assertEquals(1, message.retryCount());
        assertEquals(OutboxStatus.PENDING, message.status());
        assertEquals("Connection timed out", message.lastError());
        // Backoff for retry 1: 2^1 = 2 seconds = 2000 ms
        assertEquals(now + 2000L, message.nextRetryAtEpochMs());

        // Ineligible before backoff threshold
        assertFalse(message.isEligibleForProcessing(now + 1000L));
        // Eligible after backoff threshold
        assertTrue(message.isEligibleForProcessing(now + 2000L));
        assertTrue(message.isEligibleForProcessing(now + 3000L));
    }

    @Test
    @DisplayName("recordFailure transitions to DEAD_LETTER when max retries exceeded")
    void testRecordFailureDeadLetter() {
        long now = 1000000L;
        OutboxMessageAggregate message = new OutboxMessageAggregate(
            OutboxMessageId.of("evt-max"),
            "ARTICLE_PUBLISHED", "article", "art-1", "tenant-1", "{}",
            OutboxStatus.PENDING, 4, 5, null, null, null, now
        );

        message.recordFailure("Fatal HTTP 500", now);

        assertEquals(5, message.retryCount());
        assertEquals(OutboxStatus.DEAD_LETTER, message.status());
        assertEquals("Fatal HTTP 500", message.lastError());
        assertNull(message.nextRetryAtEpochMs());
        assertFalse(message.isEligibleForProcessing(now + 999999L));
    }
}
