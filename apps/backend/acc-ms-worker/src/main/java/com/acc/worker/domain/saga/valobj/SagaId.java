package com.acc.worker.domain.saga.valobj;

import com.acc.core.domain.ValueObject;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record SagaId(String value) implements ValueObject, Serializable {
    public SagaId {
        Objects.requireNonNull(value, "SagaId value cannot be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("SagaId cannot be blank");
        }
    }

    public static SagaId of(String value) {
        return new SagaId(value);
    }

    public static SagaId random() {
        return new SagaId(UUID.randomUUID().toString());
    }
}
