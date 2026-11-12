package com.acc.domain.outbox;

import com.acc.domain.BaseModel;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

/**
 * JPA entity representing a transactional outbox event in UNIPOST_EVENT_OUTBOX.
 */
@Getter
@Setter
@Entity
@Table(name = "UNIPOST_EVENT_OUTBOX")
public class OutboxEvent extends BaseModel {

    @Column(name = "event_id", nullable = false, unique = true)
    private String eventId;

    @Column(name = "event_type", nullable = false)
    private String eventType;

    @Column(name = "aggregate_type", nullable = false)
    private String aggregateType;

    @Column(name = "aggregate_id", nullable = false)
    private String aggregateId;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(name = "payload", nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(name = "status", nullable = false)
    private String status = "PENDING"; // PENDING, PUBLISHED, FAILED, DEAD_LETTER

    @Column(name = "retry_count", nullable = false)
    private Integer retryCount = 0;

    @Column(name = "max_retries", nullable = false)
    private Integer maxRetries = 5;

    @Column(name = "last_error", columnDefinition = "TEXT")
    private String lastError;

    @Column(name = "next_retry_at")
    private LocalDateTime nextRetryAt;

    @Column(name = "processed_at")
    private LocalDateTime processedAt;
}
