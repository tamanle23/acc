package com.unipost.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.domain.outbox.OutboxEvent;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.repository.jpa.OutboxEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.UUID;

/**
 * Service responsible for creating transactional outbox events within the current database transaction.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OutboxEventPublisher {

    private final OutboxEventRepository outboxEventRepository;
    private final ObjectMapper objectMapper;

    /**
     * Publishes an event into the transactional outbox table (UNIPOST_EVENT_OUTBOX).
     *
     * @param aggregateType the aggregate category (e.g. "entity_record", "article", "billing")
     * @param aggregateId   the primary identity of the aggregate
     * @param eventType     the event action type (e.g. "RECORD_CREATED", "RECORD_UPDATED", "RECORD_DELETED")
     * @param payload       event payload data to be serialized to JSON
     * @return the persisted OutboxEvent
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public OutboxEvent publish(String aggregateType, String aggregateId, String eventType, Object payload) {
        String tenantId = TenantContextHolder.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = "DEFAULT";
        }
        return publish(aggregateType, aggregateId, eventType, tenantId, payload);
    }

    /**
     * Publishes an event with an explicit tenant boundary.
     *
     * @param aggregateType the aggregate category
     * @param aggregateId   the primary identity of the aggregate
     * @param eventType     the event action type
     * @param tenantId      the tenant context identity
     * @param payload       event payload data to be serialized to JSON
     * @return the persisted OutboxEvent
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public OutboxEvent publish(String aggregateType, String aggregateId, String eventType, String tenantId, Object payload) {
        String eventId = UUID.randomUUID().toString();
        String jsonPayload;
        try {
            if (payload instanceof String str) {
                jsonPayload = str;
            } else {
                jsonPayload = objectMapper.writeValueAsString(payload);
            }
        } catch (Exception e) {
            log.error("Failed to serialize outbox event payload for aggregate {}/{}", aggregateType, aggregateId, e);
            jsonPayload = "{}";
        }

        OutboxEvent event = new OutboxEvent();
        event.setEventId(eventId);
        event.setAggregateType(aggregateType);
        event.setAggregateId(aggregateId);
        event.setEventType(eventType);
        event.setTenantId(tenantId != null ? tenantId : "DEFAULT");
        event.setPayload(jsonPayload);
        event.setStatus("PENDING");
        event.setRetryCount(0);
        event.setMaxRetries(5);
        event.setCreatedDate(LocalDateTime.now());

        OutboxEvent saved = outboxEventRepository.save(event);
        log.debug("Enqueued transactional outbox event '{}' [type={}, aggregate={}/{}]",
                eventId, eventType, aggregateType, aggregateId);
        return saved;
    }
}
