package com.acc.presentation.dto.metadata;

import java.time.LocalDateTime;
import java.util.Map;

public record EntityRecordResponse(
        Long id,
        String uid,
        Long entityTypeId,
        String tenantId,
        Long schemaVersion,
        Map<String, Object> attributes,
        Long version,
        LocalDateTime createdDate,
        LocalDateTime lastUpdatedDate
) {}
