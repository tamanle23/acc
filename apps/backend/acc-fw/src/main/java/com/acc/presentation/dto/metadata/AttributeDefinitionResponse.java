package com.acc.presentation.dto.metadata;

import java.time.LocalDateTime;
import java.util.Map;

public record AttributeDefinitionResponse(
        Long id,
        String uid,
        Long entityTypeId,
        String name,
        String systemName,
        String dataType,
        String uiComponent,
        Boolean isRequired,
        Boolean isArchived,
        Integer displayOrder,
        Map<String, Object> options,
        String defaultValue,
        Long version,
        LocalDateTime createdDate,
        LocalDateTime lastUpdatedDate
) {}
