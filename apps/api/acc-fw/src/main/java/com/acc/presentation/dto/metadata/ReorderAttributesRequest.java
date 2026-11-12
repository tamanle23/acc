package com.acc.presentation.dto.metadata;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record ReorderAttributesRequest(
        @NotEmpty(message = "attributeIds must not be empty")
        List<Long> attributeIds
) {}
