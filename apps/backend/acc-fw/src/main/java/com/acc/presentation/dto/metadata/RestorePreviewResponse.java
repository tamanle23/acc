package com.acc.presentation.dto.metadata;

import java.util.List;
import java.util.Map;

public record RestorePreviewResponse(
        Long recordId,
        Long targetVersion,
        Long targetAuditId,
        Map<String, Object> proposedAttributes,
        Map<String, Object> currentAttributes,
        Map<String, Object> delta,
        Map<String, Object> appliedDefaults,
        List<String> removedFields
) {}
