package com.acc.service.exception;

import com.acc.core.exception.BusinessException;
import com.acc.core.io.Error;

public class MetadataNotFoundException extends BusinessException {

    private static final long serialVersionUID = 1L;

    public MetadataNotFoundException(String message) {
        super(message);
        getErrors().add(Error.builder().code("METADATA_NOT_FOUND").message(message).build());
        setHttpCode(404);
        setServerSide(false);
    }
}
