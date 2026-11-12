package com.acc.worker.domain.saga.model;

import com.acc.core.domain.AggregateRoot;
import com.acc.core.domain.exception.DomainValidationException;
import com.acc.worker.domain.saga.valobj.SagaId;
import com.acc.worker.domain.saga.valobj.SagaStatus;

import java.util.Objects;

/**
 * Pure Domain Aggregate Root for Distributed Sagas.
 * ZERO framework, JPA, Hibernate, Jackson, or Spring imports.
 */
public final class SagaInstanceAggregate extends AggregateRoot<SagaId> {

    private final String sagaType;
    private final String correlationId;
    private String currentStep;
    private SagaStatus status;
    private String payloadJson;
    private final long createdAtEpochMs;
    private long updatedAtEpochMs;

    public SagaInstanceAggregate(
        SagaId id, String sagaType, String correlationId, String currentStep,
        SagaStatus status, String payloadJson, long createdAtEpochMs, long updatedAtEpochMs
    ) {
        this.setId(Objects.requireNonNull(id, "SagaId cannot be null"));
        this.sagaType = Objects.requireNonNull(sagaType, "sagaType cannot be null");
        this.correlationId = Objects.requireNonNull(correlationId, "correlationId cannot be null");
        this.currentStep = currentStep != null ? currentStep : "INIT";
        this.status = status != null ? status : SagaStatus.STARTED;
        this.payloadJson = payloadJson != null ? payloadJson : "{}";
        this.createdAtEpochMs = createdAtEpochMs;
        this.updatedAtEpochMs = updatedAtEpochMs;
    }

    public static SagaInstanceAggregate start(String sagaType, String correlationId, String initialPayload, long nowEpochMs) {
        return new SagaInstanceAggregate(
            SagaId.random(), sagaType, correlationId, "INIT",
            SagaStatus.STARTED, initialPayload, nowEpochMs, nowEpochMs
        );
    }

    public void advanceStep(String nextStep, long nowEpochMs) {
        if (nextStep == null || nextStep.isBlank()) {
            throw new DomainValidationException("nextStep cannot be blank");
        }
        if (this.status == SagaStatus.COMPLETED || this.status == SagaStatus.FAILED) {
            throw new DomainValidationException("Cannot advance a terminated saga: " + this.status);
        }
        this.currentStep = nextStep;
        this.status = SagaStatus.PROCESSING;
        this.updatedAtEpochMs = nowEpochMs;
    }

    public void complete(long nowEpochMs) {
        this.status = SagaStatus.COMPLETED;
        this.currentStep = "COMPLETED";
        this.updatedAtEpochMs = nowEpochMs;
    }

    public void fail(String reason, long nowEpochMs) {
        this.status = SagaStatus.FAILED;
        this.currentStep = "FAILED: " + (reason != null ? reason : "Unknown");
        this.updatedAtEpochMs = nowEpochMs;
    }

    public String sagaType() { return sagaType; }
    public String correlationId() { return correlationId; }
    public String currentStep() { return currentStep; }
    public SagaStatus status() { return status; }
    public String payloadJson() { return payloadJson; }
    public long createdAtEpochMs() { return createdAtEpochMs; }
    public long updatedAtEpochMs() { return updatedAtEpochMs; }
}
