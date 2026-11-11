package com.acc.worker.outbox;

import com.acc.repository.jpa.OutboxEventRepository;
import com.acc.worker.application.outbox.ports.in.ProcessOutboxQueueUseCase;
import com.acc.worker.application.outbox.service.ProcessOutboxQueueApplicationService;
import com.acc.worker.infrastructure.adapters.outbound.persistence.JpaOutboxRepositoryAdapter;
import com.acc.worker.infrastructure.adapters.outbound.transport.HttpWebhookTransportAdapter;
import com.acc.worker.service.WebhookDeliveryService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Scheduled background worker job acting as the Primary Driving Adapter
 * polling the outbox queue and delegating batch processing to ProcessOutboxQueueUseCase.
 */
@Slf4j
@Component
public class OutboxPollingJob {

    private final ProcessOutboxQueueUseCase processOutboxQueueUseCase;

    @Value("${application.outbox.batch-size:50}")
    private int batchSize = 50;

    @Value("${application.outbox.enabled:true}")
    private boolean outboxEnabled = true;

    @Autowired
    public OutboxPollingJob(ProcessOutboxQueueUseCase processOutboxQueueUseCase) {
        this.processOutboxQueueUseCase = processOutboxQueueUseCase;
    }

    /**
     * Backward-compatible constructor for unit testing and direct instantiation.
     */
    public OutboxPollingJob(
        OutboxEventRepository outboxEventRepository,
        WebhookDeliveryService webhookDeliveryService,
        ObjectMapper objectMapper
    ) {
        this.processOutboxQueueUseCase = new ProcessOutboxQueueApplicationService(
            new JpaOutboxRepositoryAdapter(outboxEventRepository),
            new HttpWebhookTransportAdapter(webhookDeliveryService),
            objectMapper != null ? objectMapper : new ObjectMapper()
        );
    }

    /**
     * Periodically polls pending events and dispatches them.
     * Runs every 1-2 seconds with a 5-second initial delay.
     */
    @Scheduled(fixedRateString = "${application.outbox.poll-interval-ms:2000}", initialDelay = 5000)
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
     * Processes a single batch of pending outbox events.
     *
     * @return the number of events examined/processed
     */
    public int processBatch() {
        return processOutboxQueueUseCase.processBatch(batchSize, System.currentTimeMillis());
    }
}
