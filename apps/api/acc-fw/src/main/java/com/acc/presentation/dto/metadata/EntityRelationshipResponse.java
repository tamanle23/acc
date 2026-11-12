package com.acc.presentation.dto.metadata;

import java.time.LocalDateTime;
import java.util.Map;

public record EntityRelationshipResponse(
        Long id,
        String uid,
        Long sourceEntityId,
        Long targetEntityId,
        Long relationshipTypeId,
        String relationshipTypeSystemName,
        Map<String, Object> edgeMetadata,
        Long version,
        LocalDateTime createdDate,
        LocalDateTime lastUpdatedDate
) {}
