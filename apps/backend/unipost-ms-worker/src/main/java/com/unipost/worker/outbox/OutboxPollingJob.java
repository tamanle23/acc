package com.unipost.worker.outbox;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.domain.outbox.OutboxEvent;
import com.unipost.repository.jpa.OutboxEventRepository;
import com.unipost.worker.service.WebhookDeliveryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Scheduled background worker job that polls the UNIPOST_EVENT_OUTBOX table,
 * locks pending events via SKIP LOCKED, dispatches events to registered sinks
 * (such as edge revalidation webhooks), and manages retry state with exponential backoff and DLQ.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class OutboxPollingJob {

    private final OutboxEventRepository outboxEventRepository;
    private final WebhookDeliveryService webhookDeliveryService;
    private final ObjectMapper objectMapper;

    @Value("${application.outbox.batch-size:50}")
    private int batchSize = 50;

    @Value("${application.outbox.max-retries:5}")
    private int defaultMaxRetries = 5;

    @Value("${application.outbox.enabled:true}")
    private boolean outboxEnabled = true;

    /**
     * Periodically polls pending events and dispatches them.
     * Runs every 1 second with a 5-second initial delay.
     */
    @Scheduled(fixedDelayString = "${application.outbox.poll-interval-ms:1000}", initialDelay = 5000)
    public void pollAndProcessOutboxEvents() {
        if (!outboxEnabled) {
            return;
        }

        try {
            processBatch();
        } catch (Exception e) {
            log.error("Unhandled error during outbox polling batch execution", e);
        }
    }

    /**
     * Processes a single batch of pending outbox events inside a transaction boundary.
     *
     * @return the number of events processed
     */
    @Transactional
    public int processBatch() {
        List<OutboxEvent> pendingEvents = outboxEventRepository.findPendingEventsForProcessing(batchSize);
        if (pendingEvents == null || pendingEvents.isEmpty()) {
            return 0;
        }

        log.debug("Found {} pending outbox event(s) for processing", pendingEvents.size());
        LocalDateTime now = LocalDateTime.now();

        for (OutboxEvent event : pendingEvents) {
            // Check backoff threshold if nextRetryAt is set
            if (event.getNextRetryAt() != null && event.getNextRetryAt().isAfter(now)) {
                continue;
            }

            try {
                dispatchEvent(event);
                event.setStatus("PUBLISHED");
                event.setProcessedAt(LocalDateTime.now());
                event.setLastError(null);
                outboxEventRepository.save(event);
                log.info("Successfully published outbox event [id={}, type={}, aggregate={}/{}]",
                        event.getEventId(), event.getEventType(), event.getAggregateType(), event.getAggregateId());
            } catch (Exception e) {
                int retryCount = (event.getRetryCount() != null ? event.getRetryCount() : 0) + 1;
                event.setRetryCount(retryCount);
                event.setLastError(e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName());

                int maxRetries = event.getMaxRetries() != null ? event.getMaxRetries() : defaultMaxRetries;
                if (retryCount >= maxRetries) {
                    event.setStatus("DEAD_LETTER");
                    log.error("Outbox event [id={}, aggregate={}/{}] moved to DEAD_LETTER after {} failed attempts: {}",
                            event.getEventId(), event.getAggregateType(), event.getAggregateId(), retryCount, e.getMessage());
                } else {
                    event.setStatus("PENDING");
                    // Exponential backoff: 2^retryCount seconds
                    long backoffSeconds = Math.min((long) Math.pow(2, retryCount), 300);
                    event.setNextRetryAt(now.plusSeconds(backoffSeconds));
                    log.warn("Outbox event [id={}, aggregate={}/{}] failed attempt {}. Scheduling retry in {}s: {}",
                            event.getEventId(), event.getAggregateType(), event.getAggregateId(), retryCount, backoffSeconds, e.getMessage());
                }
                outboxEventRepository.save(event);
            }
        }

        return pendingEvents.size();
    }

    /**
     * Dispatches an individual event based on aggregate type and content.
     */
    private void dispatchEvent(OutboxEvent event) throws Exception {
        Map<String, Object> payloadMap = parsePayload(event.getPayload());

        // 1. Article / CMS Webhook Dispatching (Edge revalidation for tekgo-ui)
        String slug = extractSlug(payloadMap);
        if (slug != null || "article".equalsIgnoreCase(event.getAggregateType())) {
            String tag = (String) payloadMap.getOrDefault("category", "all");
            boolean delivered = webhookDeliveryService.triggerEdgeRevalidation(slug, tag);
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
}
