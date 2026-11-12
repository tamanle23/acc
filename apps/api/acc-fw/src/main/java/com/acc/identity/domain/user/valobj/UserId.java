package com.acc.identity.domain.user.valobj;

import com.acc.core.domain.ValueObject;

import java.util.Objects;
import java.util.UUID;

public record UserId(String value) implements ValueObject {
    public UserId {
        Objects.requireNonNull(value, "UserId value cannot be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("UserId value cannot be blank");
        }
    }

    public static UserId random() {
        return new UserId(UUID.randomUUID().toString());
    }

    public static UserId of(String value) {
        return new UserId(value);
    }
}
