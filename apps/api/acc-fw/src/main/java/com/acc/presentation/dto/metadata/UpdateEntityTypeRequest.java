package com.acc.presentation.dto.metadata;

import com.acc.domain.metadata.CompositeSpec;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record UpdateEntityTypeRequest(
        @NotBlank(message = "name is required")
        @Size(max = 255, message = "name must not exceed 255 characters")
        String name,

        @Size(max = 4000, message = "description must not exceed 4000 characters")
        String description,

        Long version,

        Boolean isComposite,

        CompositeSpec compositeSpec
) {
    public UpdateEntityTypeRequest(String name, String description, Long version) {
        this(name, description, version, null, null);
    }
}
