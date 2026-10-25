package com.acc.domain.metadata;

import java.time.Instant;
import java.util.Map;

public record EntityStateChangedEvent(
    String tenantId,
    Long entityTypeId,
    Long recordId,
    String oldState,
    String newState,
    String action,
    String triggeredBy,
    Map<String, Object> attributesSnapshot,
    Instant timestamp
) {}
