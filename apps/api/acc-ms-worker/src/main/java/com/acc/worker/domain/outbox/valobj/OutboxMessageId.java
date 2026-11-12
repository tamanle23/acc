package com.acc.worker.domain.outbox.valobj;

import com.acc.core.domain.ValueObject;
import java.io.Serializable;
import java.util.Objects;
import java.util.UUID;

public record OutboxMessageId(String value) implements ValueObject, Serializable {
    public OutboxMessageId {
        Objects.requireNonNull(value, "OutboxMessageId value cannot be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("OutboxMessageId cannot be blank");
        }
    }

    public static OutboxMessageId of(String value) {
        return new OutboxMessageId(value);
    }

    public static OutboxMessageId random() {
        return new OutboxMessageId(UUID.randomUUID().toString());
    }
}
