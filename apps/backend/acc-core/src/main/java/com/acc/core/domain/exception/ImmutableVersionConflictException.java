package com.acc.core.domain.exception;

public class ImmutableVersionConflictException extends DomainException {

    public ImmutableVersionConflictException(String message) {
        super(DomainErrorCode.VERSION_CONFLICT, message);
    }
}
