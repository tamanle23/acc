package com.acc.core.domain.exception;

public enum DomainErrorCode {
    VALIDATION_FAILED("DOMAIN_422_VALIDATION", 422),
    ENTITY_NOT_FOUND("DOMAIN_404_NOT_FOUND", 404),
    VERSION_CONFLICT("DOMAIN_409_CONFLICT", 409),
    IMMUTABLE_VIOLATION("DOMAIN_409_IMMUTABLE", 409),
    UNAUTHORIZED_ACCESS("DOMAIN_403_FORBIDDEN", 403),
    BUSINESS_RULE_VIOLATION("DOMAIN_400_BAD_REQUEST", 400);

    private final String code;
    private final int httpStatus;

    DomainErrorCode(String code, int httpStatus) {
        this.code = code;
        this.httpStatus = httpStatus;
    }

    public String getCode() {
        return code;
    }

    public int getHttpStatus() {
        return httpStatus;
    }
}
