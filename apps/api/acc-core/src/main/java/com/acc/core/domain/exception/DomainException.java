package com.acc.core.domain.exception;

/**
 * Base unchecked exception for all pure domain rule violations.
 * ZERO framework dependencies.
 */
public class DomainException extends RuntimeException {

    private final DomainErrorCode errorCode;

    public DomainException(DomainErrorCode errorCode, String message) {
        super(message);
        this.errorCode = errorCode;
    }

    public DomainException(DomainErrorCode errorCode, String message, Throwable cause) {
        super(message, cause);
        this.errorCode = errorCode;
    }

    public DomainErrorCode getErrorCode() {
        return errorCode;
    }
}
