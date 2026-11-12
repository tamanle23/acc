package com.acc.presentation.dto.metadata;

import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record UpdateRecordRequest(
        @NotNull(message = "attributes map is required")
        Map<String, Object> attributes,

        Long version,

        Map<String, Object> baseAttributes
) {
    public UpdateRecordRequest(Map<String, Object> attributes, Long version) {
        this(attributes, version, null);
    }
}
