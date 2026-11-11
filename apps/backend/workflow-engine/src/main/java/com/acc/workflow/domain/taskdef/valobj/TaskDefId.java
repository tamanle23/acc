package com.acc.workflow.domain.taskdef.valobj;

import com.acc.core.domain.ValueObject;

import java.util.Objects;
import java.util.UUID;

public record TaskDefId(String value) implements ValueObject {
    public TaskDefId {
        Objects.requireNonNull(value, "TaskDefId value cannot be null");
        if (value.isBlank()) {
            throw new IllegalArgumentException("TaskDefId value cannot be blank");
        }
    }

    public static TaskDefId random() {
        return new TaskDefId(UUID.randomUUID().toString());
    }

    public static TaskDefId of(String value) {
        return new TaskDefId(value);
    }
}
