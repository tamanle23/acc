package com.acc.presentation.dto.metadata;

import java.util.List;

public record SchemaDriftAnalysisResponse(
        Long entityTypeId,
        Long currentSchemaVersion,
        long totalRecords,
        long outdatedRecords,
        long compliantRecords
) {}
