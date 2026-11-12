package com.acc.worker.domain.outbox.repository;

import com.acc.worker.domain.outbox.model.OutboxMessageAggregate;
import com.acc.worker.domain.outbox.valobj.OutboxMessageId;

import java.util.List;
import java.util.Optional;

/**
 * Secondary Driven Port (SPI) for Outbox message persistence.
 */
public interface OutboxRepositoryPort {

    List<OutboxMessageAggregate> findPendingMessages(int limit);

    void save(OutboxMessageAggregate message);

    Optional<OutboxMessageAggregate> findById(OutboxMessageId id);
}
