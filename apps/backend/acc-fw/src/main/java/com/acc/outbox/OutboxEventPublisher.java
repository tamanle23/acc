package com.acc.outbox;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.outbox.OutboxEvent;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.repository.jpa.OutboxEventRepository;
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
            java.util.Map<String, Object> payloadMap;
            if (payload instanceof java.util.Map<?, ?> map) {
                payloadMap = new java.util.HashMap<>((java.util.Map<String, Object>) map);
            } else if (payload instanceof String str && !str.isBlank()) {
                payloadMap = objectMapper.readValue(str, new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {});
            } else {
                payloadMap = objectMapper.convertValue(payload, new com.fasterxml.jackson.core.type.TypeReference<java.util.Map<String, Object>>() {});
            }

            // Propagate active W3C traceparent into outbox event payload metadata
            String traceId = org.slf4j.MDC.get("trace_id");
            if (traceId == null) {
                traceId = org.slf4j.MDC.get("traceId");
            }
            if (traceId != null && !payloadMap.containsKey("traceparent")) {
                String spanId = java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 16);
                payloadMap.put("traceparent", String.format("00-%s-%s-01", traceId, spanId));
                payloadMap.put("trace_id", traceId);
            }
            jsonPayload = objectMapper.writeValueAsString(payloadMap);
        } catch (Exception e) {
            log.error("Failed to serialize outbox event payload for aggregate {}/{}", aggregateType, aggregateId, e);
            jsonPayload = payload instanceof String str ? str : "{}";
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
