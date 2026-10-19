package com.unipost.domain.metadata;

import java.time.Instant;
import java.util.Map;

public record EntityRecordMutatedEvent(
    Long entityTypeId,
    Long recordId,
    String tenantId,
    String action, // CREATE, UPDATE, DELETE, RESTORE, TRANSITION
    String actor,
    Long version,
    Map<String, Object> attributes,
    Map<String, Object> delta,
    Instant timestamp
) {}
