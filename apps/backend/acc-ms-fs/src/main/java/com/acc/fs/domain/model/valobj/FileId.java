package com.acc.fs.domain.model.valobj;

import com.acc.core.domain.ValueObject;

import java.util.Objects;
import java.util.UUID;

public record FileId(String value) implements ValueObject {
    public FileId {
        Objects.requireNonNull(value, "FileId value cannot be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("FileId value cannot be blank");
        }
    }

    public static FileId random() {
        return new FileId(UUID.randomUUID().toString());
    }

    public static FileId of(String value) {
        return new FileId(value);
    }
}
