package com.acc.presentation.dto.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;

public record ChildFilterCriteria(
    @JsonProperty("op")
    String op,

    @JsonProperty("value")
    Object value
) implements Serializable {

    public String effectiveOp() {
        if (op == null || op.isBlank()) {
            return "eq";
        }
        return op.trim().toLowerCase();
    }
}
