package com.acc.worker.application.outbox.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.worker.application.outbox.ports.in.ProcessOutboxQueueUseCase;
import com.acc.worker.application.outbox.ports.out.WebhookTransportPort;
import com.acc.worker.domain.outbox.model.OutboxMessageAggregate;
import com.acc.worker.domain.outbox.repository.OutboxRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Application Service coordinating the transactional outbox queue processing.
 */
@Service
public class ProcessOutboxQueueApplicationService implements ProcessOutboxQueueUseCase {

    private static final Logger log = LoggerFactory.getLogger(ProcessOutboxQueueApplicationService.class);
    private static final Pattern TRACEPARENT_PATTERN = Pattern.compile("^00-([a-f0-9]{32})-");

    private final OutboxRepositoryPort outboxRepositoryPort;
    private final WebhookTransportPort webhookTransportPort;
    private final ObjectMapper objectMapper;

    public ProcessOutboxQueueApplicationService(
        OutboxRepositoryPort outboxRepositoryPort,
        WebhookTransportPort webhookTransportPort,
        ObjectMapper objectMapper
    ) {
        this.outboxRepositoryPort = outboxRepositoryPort;
        this.webhookTransportPort = webhookTransportPort;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public int processBatch(int batchSize, long nowEpochMs) {
        List<OutboxMessageAggregate> pending = outboxRepositoryPort.findPendingMessages(batchSize);
        if (pending == null || pending.isEmpty()) {
            return 0;
        }

        log.debug("Found {} pending outbox event(s) for processing", pending.size());

        for (OutboxMessageAggregate message : pending) {
            if (!message.isEligibleForProcessing(nowEpochMs)) {
                continue;
            }

            String tenantId = message.tenantId();
            Map<String, Object> payloadMap = parsePayload(message.payload());
            String traceId = extractTraceId(payloadMap);

            try {
                if (tenantId != null) {
                    MDC.put("tenant_id", tenantId);
                    MDC.put("tenantId", tenantId);
                }
                if (traceId != null) {
                    MDC.put("trace_id", traceId);
                    MDC.put("traceId", traceId);
                }

                dispatchMessage(message, payloadMap);
                message.markPublished(nowEpochMs);
                outboxRepositoryPort.save(message);

                log.info("Successfully published outbox event [id={}, type={}, aggregate={}/{}]",
                    message.getId().value(), message.eventType(), message.aggregateType(), message.aggregateId());
            } catch (Exception e) {
                message.recordFailure(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName(), nowEpochMs);
                outboxRepositoryPort.save(message);

                log.warn("Outbox event [id={}, aggregate={}/{}] processing attempt failed: {}",
                    message.getId().value(), message.aggregateType(), message.aggregateId(), e.getMessage());
            } finally {
                MDC.remove("tenant_id");
                MDC.remove("tenantId");
                MDC.remove("trace_id");
                MDC.remove("traceId");
            }
        }

        return pending.size();
    }

    private void dispatchMessage(OutboxMessageAggregate message, Map<String, Object> payloadMap) throws Exception {
        String slug = extractSlug(payloadMap);
        if (slug != null || "article".equalsIgnoreCase(message.aggregateType())) {
            String tag = (String) payloadMap.getOrDefault("category", "all");
            String traceparent = (String) payloadMap.get("traceparent");
            boolean delivered = webhookTransportPort.triggerEdgeRevalidation(slug, tag, traceparent);
            if (!delivered) {
                throw new IllegalStateException("Edge revalidation webhook delivery returned non-200 status or timed out");
            }
        }
    }

    private Map<String, Object> parsePayload(String rawPayload) {
        if (rawPayload == null || rawPayload.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(rawPayload, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.warn("Failed to parse outbox event payload as JSON map: {}", e.getMessage());
            return Map.of();
        }
    }

    private String extractSlug(Map<String, Object> payloadMap) {
        if (payloadMap == null) return null;
        Object slugObj = payloadMap.get("slug");
        if (slugObj != null && !slugObj.toString().isBlank()) {
            return slugObj.toString();
        }
        return null;
    }

    private String extractTraceId(Map<String, Object> payloadMap) {
        String traceId = (String) payloadMap.get("trace_id");
        if (traceId == null && payloadMap.get("traceparent") instanceof String tp) {
            Matcher m = TRACEPARENT_PATTERN.matcher(tp);
            if (m.find()) {
                traceId = m.group(1);
            }
        }
        return traceId;
    }
}
