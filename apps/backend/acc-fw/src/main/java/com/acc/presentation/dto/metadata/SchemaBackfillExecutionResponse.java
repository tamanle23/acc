package com.acc.presentation.dto.metadata;

import java.util.List;

public record SchemaBackfillExecutionResponse(
        Long entityTypeId,
        Long targetSchemaVersion,
        int processedRecords,
        int migratedRecords,
        int failedRecords,
        List<BackfillFailureDetail> failures
) {
    public record BackfillFailureDetail(
            Long recordId,
            String reason
    ) {}
}
