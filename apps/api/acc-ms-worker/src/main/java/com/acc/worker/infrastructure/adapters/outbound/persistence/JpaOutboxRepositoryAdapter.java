package com.acc.worker.infrastructure.adapters.outbound.persistence;

import com.acc.domain.outbox.OutboxEvent;
import com.acc.repository.jpa.OutboxEventRepository;
import com.acc.worker.domain.outbox.model.OutboxMessageAggregate;
import com.acc.worker.domain.outbox.repository.OutboxRepositoryPort;
import com.acc.worker.domain.outbox.valobj.OutboxMessageId;
import com.acc.worker.domain.outbox.valobj.OutboxStatus;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Repository
public class JpaOutboxRepositoryAdapter implements OutboxRepositoryPort {

    private final OutboxEventRepository outboxEventRepository;
    private final Map<String, OutboxEvent> entityCache = new ConcurrentHashMap<>();

    public JpaOutboxRepositoryAdapter(OutboxEventRepository outboxEventRepository) {
        this.outboxEventRepository = outboxEventRepository;
    }

    @Override
    public List<OutboxMessageAggregate> findPendingMessages(int limit) {
        List<OutboxEvent> entities = outboxEventRepository.findPendingEventsForProcessing(limit);
        if (entities != null) {
            for (OutboxEvent entity : entities) {
                if (entity.getEventId() != null) {
                    entityCache.put(entity.getEventId(), entity);
                }
            }
        }
        return entities == null ? List.of() : entities.stream().map(this::toAggregate).collect(Collectors.toList());
    }

    @Override
    public void save(OutboxMessageAggregate aggregate) {
        String eventId = aggregate.getId().value();
        OutboxEvent entity = entityCache.get(eventId);
        if (entity == null) {
            entity = outboxEventRepository.findByEventId(eventId).orElse(null);
        }
        if (entity == null) {
            entity = new OutboxEvent();
            entity.setEventId(eventId);
            entityCache.put(eventId, entity);
        }

        entity.setEventType(aggregate.eventType());
        entity.setAggregateType(aggregate.aggregateType());
        entity.setAggregateId(aggregate.aggregateId());
        entity.setTenantId(aggregate.tenantId());
        entity.setPayload(aggregate.payload());
        entity.setStatus(aggregate.status().name());
        entity.setRetryCount(aggregate.retryCount());
        entity.setMaxRetries(aggregate.maxRetries());
        entity.setLastError(aggregate.lastError());

        if (aggregate.nextRetryAtEpochMs() != null) {
            entity.setNextRetryAt(LocalDateTime.ofInstant(
                Instant.ofEpochMilli(aggregate.nextRetryAtEpochMs()), ZoneId.systemDefault()
            ));
        } else {
            entity.setNextRetryAt(null);
        }

        if (aggregate.processedAtEpochMs() != null) {
            entity.setProcessedAt(LocalDateTime.ofInstant(
                Instant.ofEpochMilli(aggregate.processedAtEpochMs()), ZoneId.systemDefault()
            ));
        } else {
            entity.setProcessedAt(null);
        }

        outboxEventRepository.save(entity);
    }

    @Override
    public Optional<OutboxMessageAggregate> findById(OutboxMessageId id) {
        OutboxEvent cached = entityCache.get(id.value());
        if (cached != null) {
            return Optional.of(toAggregate(cached));
        }
        return outboxEventRepository.findByEventId(id.value()).map(entity -> {
            entityCache.put(entity.getEventId(), entity);
            return toAggregate(entity);
        });
    }

    private OutboxMessageAggregate toAggregate(OutboxEvent entity) {
        OutboxStatus status;
        try {
            status = OutboxStatus.valueOf(entity.getStatus());
        } catch (Exception e) {
            status = OutboxStatus.PENDING;
        }

        Long nextRetryEpochMs = entity.getNextRetryAt() != null
            ? entity.getNextRetryAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            : null;

        Long processedEpochMs = entity.getProcessedAt() != null
            ? entity.getProcessedAt().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            : null;

        long createdEpochMs = entity.getCreatedDate() != null
            ? entity.getCreatedDate().atZone(ZoneId.systemDefault()).toInstant().toEpochMilli()
            : System.currentTimeMillis();

        return new OutboxMessageAggregate(
            OutboxMessageId.of(entity.getEventId()),
            entity.getEventType(),
            entity.getAggregateType(),
            entity.getAggregateId(),
            entity.getTenantId(),
            entity.getPayload(),
            status,
            entity.getRetryCount() != null ? entity.getRetryCount() : 0,
            entity.getMaxRetries() != null ? entity.getMaxRetries() : 5,
            entity.getLastError(),
            nextRetryEpochMs,
            processedEpochMs,
            createdEpochMs
        );
    }
}
