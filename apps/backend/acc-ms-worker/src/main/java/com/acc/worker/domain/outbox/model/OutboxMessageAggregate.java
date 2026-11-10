package com.acc.worker.domain.outbox.model;

import com.acc.core.domain.AggregateRoot;
import com.acc.worker.domain.outbox.valobj.OutboxMessageId;
import com.acc.worker.domain.outbox.valobj.OutboxStatus;

import java.util.Objects;

/**
 * Pure Domain Aggregate Root for Transactional Outbox Messages.
 * ZERO framework, JPA, Hibernate, Jackson, or Spring imports.
 */
public final class OutboxMessageAggregate extends AggregateRoot<OutboxMessageId> {

    private final String eventType;
    private final String aggregateType;
    private final String aggregateId;
    private final String tenantId;
    private final String payload;
    private OutboxStatus status;
    private int retryCount;
    private final int maxRetries;
    private String lastError;
    private Long nextRetryAtEpochMs;
    private Long processedAtEpochMs;
    private final long createdAtEpochMs;

    public OutboxMessageAggregate(
        OutboxMessageId id, String eventType, String aggregateType, String aggregateId,
        String tenantId, String payload, OutboxStatus status, int retryCount, int maxRetries,
        String lastError, Long nextRetryAtEpochMs, Long processedAtEpochMs, long createdAtEpochMs
    ) {
        this.setId(Objects.requireNonNull(id, "OutboxMessageId cannot be null"));
        this.eventType = eventType != null ? eventType : "UNKNOWN";
        this.aggregateType = aggregateType != null ? aggregateType : "UNKNOWN";
        this.aggregateId = aggregateId != null ? aggregateId : "UNKNOWN";
        this.tenantId = tenantId != null ? tenantId : "default";
        this.payload = payload != null ? payload : "{}";
        this.status = status != null ? status : OutboxStatus.PENDING;
        this.retryCount = Math.max(0, retryCount);
        this.maxRetries = maxRetries > 0 ? maxRetries : 5;
        this.lastError = lastError;
        this.nextRetryAtEpochMs = nextRetryAtEpochMs;
        this.processedAtEpochMs = processedAtEpochMs;
        this.createdAtEpochMs = createdAtEpochMs;
    }

    public static OutboxMessageAggregate createNew(
        String eventType, String aggregateType, String aggregateId, String tenantId, String payload, long nowEpochMs
    ) {
        return new OutboxMessageAggregate(
            OutboxMessageId.random(), eventType, aggregateType, aggregateId,
            tenantId, payload, OutboxStatus.PENDING, 0, 5,
            null, null, null, nowEpochMs
        );
    }

    public void markPublished(long nowEpochMs) {
        this.status = OutboxStatus.PUBLISHED;
        this.processedAtEpochMs = nowEpochMs;
        this.lastError = null;
    }

    public void recordFailure(String error, long nowEpochMs) {
        this.retryCount++;
        this.lastError = error != null ? error : "Unknown error";
        if (this.retryCount >= this.maxRetries) {
            this.status = OutboxStatus.DEAD_LETTER;
            this.nextRetryAtEpochMs = null;
        } else {
            this.status = OutboxStatus.PENDING;
            long backoffSeconds = Math.min((long) Math.pow(2, this.retryCount), 300);
            this.nextRetryAtEpochMs = nowEpochMs + (backoffSeconds * 1000L);
        }
    }

    public boolean isEligibleForProcessing(long nowEpochMs) {
        return this.status == OutboxStatus.PENDING &&
            (this.nextRetryAtEpochMs == null || this.nextRetryAtEpochMs <= nowEpochMs);
    }

    public String eventType() { return eventType; }
    public String aggregateType() { return aggregateType; }
    public String aggregateId() { return aggregateId; }
    public String tenantId() { return tenantId; }
    public String payload() { return payload; }
    public OutboxStatus status() { return status; }
    public int retryCount() { return retryCount; }
    public int maxRetries() { return maxRetries; }
    public String lastError() { return lastError; }
    public Long nextRetryAtEpochMs() { return nextRetryAtEpochMs; }
    public Long processedAtEpochMs() { return processedAtEpochMs; }
    public long createdAtEpochMs() { return createdAtEpochMs; }
}
