package com.unipost.fw.exceptionhandling;

import com.unipost.core.context.Context;
import com.unipost.core.exception.BusinessException;
import com.unipost.core.exception.ErrorCodes;
import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.core.io.Status;
import com.unipost.fw.ResponseEntityBuilder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;
    private ResponseEntityBuilder responseBuilder;
    private Context contextHelper;

    @BeforeEach
    void setUp() {
        contextHelper = Mockito.mock(Context.class);
        ContextHeader header = new ContextHeader();
        when(contextHelper.getHeader()).thenReturn(header);

        responseBuilder = new ResponseEntityBuilder();
        ReflectionTestUtils.setField(responseBuilder, "contextHelper", contextHelper);

        exceptionHandler = new GlobalExceptionHandler();
        exceptionHandler.responseBuilder = responseBuilder;
    }

    @Test
    void testAccessDeniedExceptionReturnsForbidden() {
        AccessDeniedException ex = new AccessDeniedException("Access denied test");
        ResponseEntity<ResponseWrapper<ContextHeader, Object>> response =
                exceptionHandler.handleAccessDeniedException(ex);

        assertNotNull(response);
        assertEquals(HttpStatus.FORBIDDEN, response.getStatusCode());
        assertEquals(Status.ERROR, response.getBody().getStatus());
        assertEquals(ErrorCodes.ERROR_ACCESS_DENIED.name(), response.getBody().getErrors()[0].getCode());
    }

    @Test
    void testRuntimeExceptionReturnsInternalServerErrorWithFallbackMessage() {
        RuntimeException exWithoutMessage = new NullPointerException();
        ResponseEntity<ResponseWrapper<ContextHeader, Object>> response =
                exceptionHandler.handleRuntimeException(exWithoutMessage);

        assertNotNull(response);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals(Status.ERROR, response.getBody().getStatus());
        assertEquals("An unexpected runtime error occurred", response.getBody().getErrors()[0].getMessage());
    }

    @Test
    void testHttpMessageConversionExceptionReturnsBadRequest() {
        org.springframework.http.converter.HttpMessageConversionException ex =
                new org.springframework.http.converter.HttpMessageConversionException("Invalid JSON format");
        ResponseEntity<ResponseWrapper<ContextHeader, Object>> response =
                exceptionHandler.handleHttpMessageConversionException(ex);

        assertNotNull(response);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(Status.FAIL, response.getBody().getStatus());
        assertEquals(ErrorCodes.FAIL_ENDPOINT_MAPPING.name(), response.getBody().getErrors()[0].getCode());
    }

    @Test
    void testThrowableReturnsInternalServerError() {
        Exception ex = new Exception("General checked exception");
        ResponseEntity<ResponseWrapper<ContextHeader, Object>> response =
                exceptionHandler.handleThrowable(ex);

        assertNotNull(response);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR, response.getStatusCode());
        assertEquals("General checked exception", response.getBody().getErrors()[0].getMessage());
    }

    @Test
    void testBusinessExceptionWithCustomHttpCode() {
        BusinessException ex = new BusinessException("Not found");
        ex.setHttpCode(404);
        ex.getErrors().add(com.unipost.core.io.Error.builder().code("NOT_FOUND").message("Entity not found").build());

        ResponseEntity<ResponseWrapper<ContextHeader, Object>> response =
                exceptionHandler.handleBusinessException(ex);

        assertNotNull(response);
        assertEquals(HttpStatus.NOT_FOUND, response.getStatusCode());
        assertEquals("NOT_FOUND", response.getBody().getErrors()[0].getCode());
    }

    @Test
    void testBusinessExceptionClientSideDefaultBadRequest() {
        BusinessException ex = new BusinessException("Invalid input");
        ex.setServerSide(false);
        ex.getErrors().add(com.unipost.core.io.Error.builder().code("CLIENT_ERROR").message("Bad data").build());

        ResponseEntity<ResponseWrapper<ContextHeader, Object>> response =
                exceptionHandler.handleBusinessException(ex);

        assertNotNull(response);
        assertEquals(HttpStatus.BAD_REQUEST, response.getStatusCode());
        assertEquals(Status.FAIL, response.getBody().getStatus());
    }
}
