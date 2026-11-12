package com.acc.worker.infrastructure.adapters.outbound.persistence;

import com.acc.worker.domain.saga.model.SagaInstanceAggregate;
import com.acc.worker.domain.saga.repository.SagaStateRepositoryPort;
import com.acc.worker.domain.saga.valobj.SagaId;
import org.springframework.stereotype.Repository;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Repository
public class InMemorySagaStateRepositoryAdapter implements SagaStateRepositoryPort {

    private final Map<SagaId, SagaInstanceAggregate> storage = new ConcurrentHashMap<>();

    @Override
    public void save(SagaInstanceAggregate saga) {
        if (saga != null && saga.getId() != null) {
            storage.put(saga.getId(), saga);
        }
    }

    @Override
    public Optional<SagaInstanceAggregate> findById(SagaId id) {
        if (id == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(storage.get(id));
    }

    @Override
    public Optional<SagaInstanceAggregate> findByCorrelationId(String sagaType, String correlationId) {
        if (sagaType == null || correlationId == null) {
            return Optional.empty();
        }
        return storage.values().stream()
            .filter(s -> sagaType.equalsIgnoreCase(s.sagaType()) && correlationId.equals(s.correlationId()))
            .findFirst();
    }

    public void clear() {
        storage.clear();
    }
}
