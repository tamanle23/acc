package com.unipost.workspace.dto;

import java.time.LocalDateTime;

public record WorkspaceDto(
        Long id,
        String uid,
        String tenantId,
        String code,
        String name,
        String description,
        String planTier,
        Boolean isDefault,
        Boolean isImmutable,
        LocalDateTime createdDate,
        LocalDateTime lastUpdatedDate
) {}
