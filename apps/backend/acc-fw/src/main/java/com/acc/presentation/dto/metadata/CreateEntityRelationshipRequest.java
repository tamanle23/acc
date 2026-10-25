package com.acc.presentation.dto.metadata;

import jakarta.validation.constraints.NotNull;
import java.util.Map;

public record CreateEntityRelationshipRequest(
        @NotNull(message = "targetEntityId is required")
        Long targetEntityId,

        @NotNull(message = "relationshipTypeId is required")
        Long relationshipTypeId,

        Map<String, Object> edgeMetadata
) {}
