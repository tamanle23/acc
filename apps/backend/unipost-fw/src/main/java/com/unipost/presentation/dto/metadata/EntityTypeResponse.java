package com.unipost.presentation.dto.metadata;

import com.unipost.domain.metadata.LifecycleConfig;
import java.time.LocalDateTime;

public record EntityTypeResponse(
        Long id,
        String uid,
        String name,
        String systemName,
        String description,
        Long schemaVersion,
        Long version,
        LocalDateTime createdDate,
        LocalDateTime lastUpdatedDate,
        LifecycleConfig lifecycleConfig
) {
    public EntityTypeResponse(
            Long id,
            String uid,
            String name,
            String systemName,
            String description,
            Long schemaVersion,
            Long version,
            LocalDateTime createdDate,
            LocalDateTime lastUpdatedDate
    ) {
        this(id, uid, name, systemName, description, schemaVersion, version, createdDate, lastUpdatedDate, null);
    }
}
