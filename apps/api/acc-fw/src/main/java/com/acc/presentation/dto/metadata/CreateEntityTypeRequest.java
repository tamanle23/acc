package com.acc.presentation.dto.metadata;

import com.acc.domain.metadata.CompositeSpec;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateEntityTypeRequest(
        @NotBlank(message = "systemName is required")
        @Pattern(regexp = "^[a-z][a-z0-9_]{1,63}$", message = "systemName must start with a lowercase letter and contain 2-64 lowercase alphanumeric or underscore characters")
        String systemName,

        @NotBlank(message = "name is required")
        @Size(max = 255, message = "name must not exceed 255 characters")
        String name,

        @Size(max = 4000, message = "description must not exceed 4000 characters")
        String description,

        Boolean isComposite,

        CompositeSpec compositeSpec
) {
    public CreateEntityTypeRequest(String systemName, String name, String description) {
        this(systemName, name, description, false, null);
    }
}
