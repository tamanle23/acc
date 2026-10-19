package com.unipost.service.exception;

import com.unipost.core.exception.BusinessException;
import com.unipost.core.io.Error;

public class MetadataNotFoundException extends BusinessException {

    private static final long serialVersionUID = 1L;

    public MetadataNotFoundException(String message) {
        super(message);
        getErrors().add(Error.builder().code("METADATA_NOT_FOUND").message(message).build());
        setHttpCode(404);
        setServerSide(false);
    }
}
