package com.acc.presentation.dto.metadata;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record UpdateAttributeRequest(
        @NotBlank(message = "name is required")
        @Size(max = 255, message = "name must not exceed 255 characters")
        String name,

        String uiComponent,
        Boolean isRequired,
        Boolean isArchived,
        Integer displayOrder,
        Map<String, Object> options,

        @Size(max = 255, message = "defaultValue must not exceed 255 characters")
        String defaultValue,

        Long version
) {}
