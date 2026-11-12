package com.acc.worker.application.outbox.ports.in;

/**
 * Driving Inbound Port for polling and processing batches of transactional outbox events.
 */
public interface ProcessOutboxQueueUseCase {

    int processBatch(int batchSize, long nowEpochMs);
}
