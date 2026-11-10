package com.acc.worker.domain.saga.valobj;

import com.acc.core.domain.ValueObject;

public enum SagaStatus implements ValueObject {
    STARTED,
    PROCESSING,
    COMPLETED,
    COMPENSATING,
    FAILED
}
