package com.acc.core.domain.exception;

public class EntityNotFoundException extends DomainException {

    public EntityNotFoundException(String message) {
        super(DomainErrorCode.ENTITY_NOT_FOUND, message);
    }

    public EntityNotFoundException(String entityType, Object entityId) {
        super(DomainErrorCode.ENTITY_NOT_FOUND, entityType + " not found with id: " + entityId);
    }
}
