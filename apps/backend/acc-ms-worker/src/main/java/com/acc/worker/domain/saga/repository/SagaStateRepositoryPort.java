package com.acc.worker.domain.saga.repository;

import com.acc.worker.domain.saga.model.SagaInstanceAggregate;
import com.acc.worker.domain.saga.valobj.SagaId;

import java.util.Optional;

/**
 * Secondary Driven Port (SPI) for distributed Saga state persistence.
 */
public interface SagaStateRepositoryPort {

    void save(SagaInstanceAggregate saga);

    Optional<SagaInstanceAggregate> findById(SagaId id);

    Optional<SagaInstanceAggregate> findByCorrelationId(String sagaType, String correlationId);
}
