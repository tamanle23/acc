package com.acc.service.exception;

import com.acc.core.exception.BusinessException;
import com.acc.core.io.Error;

public class MetadataConflictException extends BusinessException {

    private static final long serialVersionUID = 1L;

    public MetadataConflictException(String message) {
        super(message);
        getErrors().add(Error.builder().code("METADATA_CONFLICT").message(message).build());
        setHttpCode(409);
        setServerSide(false);
    }
}
