package com.acc.presentation.dto.metadata;

import java.util.List;

public record ValidateRecordResponse(
        boolean valid,
        Long entityTypeId,
        Long schemaVersion,
        List<ValidationErrorDetail> errors
) {
    public record ValidationErrorDetail(
            String field,
            String message,
            String code
    ) {}

    public static ValidateRecordResponse success(Long entityTypeId, Long schemaVersion) {
        return new ValidateRecordResponse(true, entityTypeId, schemaVersion, List.of());
    }

    public static ValidateRecordResponse failure(Long entityTypeId, Long schemaVersion, List<ValidationErrorDetail> errors) {
        return new ValidateRecordResponse(false, entityTypeId, schemaVersion, errors != null ? errors : List.of());
    }
}
