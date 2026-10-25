package com.acc.presentation.dto.metadata;

import java.time.LocalDateTime;
import java.util.Map;

public record RecordAuditLogResponse(
        Long id,
        String tenantId,
        Long recordId,
        Long entityTypeId,
        String operation,
        String actor,
        Long version,
        Map<String, Object> oldAttributes,
        Map<String, Object> newAttributes,
        Map<String, Object> delta,
        LocalDateTime createdAt
) {}
