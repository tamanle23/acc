package com.acc.presentation.dto.metadata;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateRelationshipTypeRequest(
        @NotBlank(message = "systemName is required")
        @Pattern(regexp = "^[a-z][a-z0-9_]{1,63}$", message = "systemName must start with a lowercase letter and contain 2-64 lowercase alphanumeric or underscore characters")
        String systemName,

        @Size(max = 4000, message = "description must not exceed 4000 characters")
        String description,

        Long sourceEntityTypeId,

        Long targetEntityTypeId,

        @Pattern(regexp = "^(ONE_TO_ONE|ONE_TO_MANY|MANY_TO_ONE|MANY_TO_MANY)$", message = "cardinality must be ONE_TO_ONE, ONE_TO_MANY, MANY_TO_ONE, or MANY_TO_MANY")
        String cardinality
) {}
