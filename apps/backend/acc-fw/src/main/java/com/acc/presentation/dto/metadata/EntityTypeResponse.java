package com.acc.presentation.dto.metadata;

import com.acc.domain.metadata.CompositeSpec;
import com.acc.domain.metadata.LifecycleConfig;
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
        LifecycleConfig lifecycleConfig,
        Boolean isComposite,
        CompositeSpec compositeSpec
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
        this(id, uid, name, systemName, description, schemaVersion, version, createdDate, lastUpdatedDate, null, false, null);
    }

    public EntityTypeResponse(
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
        this(id, uid, name, systemName, description, schemaVersion, version, createdDate, lastUpdatedDate, lifecycleConfig, false, null);
    }
}
