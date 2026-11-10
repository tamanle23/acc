package com.acc.worker.domain.outbox.valobj;

import com.acc.core.domain.ValueObject;

public enum OutboxStatus implements ValueObject {
    PENDING,
    PUBLISHED,
    FAILED,
    DEAD_LETTER
}
