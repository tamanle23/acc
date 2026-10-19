package com.unipost.fw.exceptionhandling;

import com.unipost.core.exception.BusinessException;
import com.unipost.core.exception.ErrorCodes;
import com.unipost.core.io.Error;
import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageConversionException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;

@ControllerAdvice
public class GlobalExceptionHandler {
  private final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @Autowired
  protected ResponseEntityBuilder responseBuilder;

  @ExceptionHandler(value = { BusinessException.class})
  protected ResponseEntity<ResponseWrapper<ContextHeader, Object>> handleBusinessException(BusinessException ex) {
    if (this.logger.isErrorEnabled()) {
      this.logger.error("Business exception: ", ex);
    }
    if (ex.getHttpCode() == null) {
      if (ex.isServerSide()) {
        return responseBuilder.error(HttpStatus.INTERNAL_SERVER_ERROR, ex.getErrors().toArray(new Error[0]));
      }
      return responseBuilder.fail(HttpStatus.BAD_REQUEST, ex.getErrors().toArray(new Error[0]));
    } else {
      return responseBuilder.error(HttpStatus.valueOf(ex.getHttpCode()), ex.getErrors().toArray(new Error[0]));
    }
  }

  @ExceptionHandler(value = { AccessDeniedException.class})
  protected ResponseEntity<ResponseWrapper<ContextHeader, Object>> handleAccessDeniedException(AccessDeniedException ex) {
    if (this.logger.isErrorEnabled()) {
      this.logger.error("Access denied error: ", ex);
    }
    return responseBuilder.error(HttpStatus.FORBIDDEN, Error.builder().code(ErrorCodes.ERROR_ACCESS_DENIED.name()).message(ErrorCodes.ERROR_ACCESS_DENIED.getMessage()).build());
  }

  @ExceptionHandler(value = { RuntimeException.class})
  protected ResponseEntity<ResponseWrapper<ContextHeader, Object>> handleRuntimeException(RuntimeException ex) {
    if (this.logger.isErrorEnabled()) {
      this.logger.error("Uncaught runtime exception: ", ex);
    }
    String message = ex.getMessage() != null && !ex.getMessage().isBlank()
        ? ex.getMessage()
        : "An unexpected runtime error occurred";
    return responseBuilder.error(HttpStatus.INTERNAL_SERVER_ERROR, Error.builder().code(ErrorCodes.NONE.name()).message(message).build());
  }

  @ExceptionHandler(value = { org.springframework.web.bind.MethodArgumentNotValidException.class })
  protected ResponseEntity<ResponseWrapper<ContextHeader, Object>> handleMethodArgumentNotValidException(org.springframework.web.bind.MethodArgumentNotValidException ex) {
    if (this.logger.isErrorEnabled()) {
      this.logger.error("Validation error: ", ex);
    }
    java.util.List<Error> errors = ex.getBindingResult().getFieldErrors().stream()
        .map(fieldError -> Error.builder()
            .code(ErrorCodes.FAIL_VALIDATION.name())
            .message(fieldError.getField() + ": " + fieldError.getDefaultMessage())
            .build())
        .collect(java.util.stream.Collectors.toList());
    if (errors.isEmpty()) {
      errors.add(Error.builder().code(ErrorCodes.FAIL_VALIDATION.name()).message(ex.getMessage()).build());
    }
    return responseBuilder.fail(HttpStatus.BAD_REQUEST, errors.toArray(new Error[0]));
  }

  @ExceptionHandler(value = { HttpMessageConversionException.class})
  protected ResponseEntity<ResponseWrapper<ContextHeader, Object>> handleHttpMessageConversionException(RuntimeException ex) {
    if (this.logger.isErrorEnabled()) {
      this.logger.error("Message conversion error: ", ex);
    }
    String message = ex.getMessage() != null && !ex.getMessage().isBlank()
        ? ex.getMessage()
        : "Malformed request payload or invalid parameters";
    return responseBuilder.fail(HttpStatus.BAD_REQUEST, Error.builder().code(ErrorCodes.FAIL_ENDPOINT_MAPPING.name()).message(message).build());
  }

  @ExceptionHandler(value = { Exception.class})
  protected ResponseEntity<ResponseWrapper<ContextHeader, Object>> handleThrowable(Throwable ex) {
    if (this.logger.isErrorEnabled()) {
      this.logger.error("Uncaught general exception: ", ex);
    }
    String message = ex.getMessage() != null && !ex.getMessage().isBlank()
        ? ex.getMessage()
        : "An unexpected internal server error occurred";
    return responseBuilder.error(HttpStatus.INTERNAL_SERVER_ERROR, Error.builder().code(ErrorCodes.NONE.name()).message(message).build());
  }
}
