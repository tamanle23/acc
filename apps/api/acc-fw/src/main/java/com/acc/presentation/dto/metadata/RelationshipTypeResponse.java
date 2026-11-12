package com.acc.presentation.dto.metadata;

import java.time.LocalDateTime;

public record RelationshipTypeResponse(
        Long id,
        String uid,
        String systemName,
        String description,
        Long sourceEntityTypeId,
        Long targetEntityTypeId,
        String cardinality,
        Long version,
        LocalDateTime createdDate,
        LocalDateTime lastUpdatedDate
) {}
