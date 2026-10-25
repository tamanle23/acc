package com.acc.presentation.dto.metadata;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;

public record CreateAttributeRequest(
        @NotBlank(message = "systemName is required")
        @Pattern(regexp = "^[a-z][a-z0-9_]{1,63}$", message = "systemName must start with a lowercase letter and contain 2-64 lowercase alphanumeric or underscore characters")
        String systemName,

        @NotBlank(message = "name is required")
        @Size(max = 255, message = "name must not exceed 255 characters")
        String name,

        @NotBlank(message = "dataType is required")
        String dataType,

        @NotBlank(message = "uiComponent is required")
        String uiComponent,

        Boolean isRequired,
        Boolean isArchived,
        Map<String, Object> options,

        @Size(max = 255, message = "defaultValue must not exceed 255 characters")
        String defaultValue
) {}
