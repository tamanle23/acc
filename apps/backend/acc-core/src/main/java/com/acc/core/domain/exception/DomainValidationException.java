package com.acc.core.domain.exception;

public class DomainValidationException extends DomainException {

    public DomainValidationException(String message) {
        super(DomainErrorCode.VALIDATION_FAILED, message);
    }
}
