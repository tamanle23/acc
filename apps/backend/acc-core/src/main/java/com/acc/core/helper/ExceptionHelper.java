package com.acc.core.helper;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

import org.apache.commons.codec.digest.DigestUtils;
import org.apache.commons.lang3.RandomStringUtils;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.slf4j.Logger;

public class ExceptionHelper {

  public static ErrorMessage logException(Logger logger, Throwable throwable) {
    StringBuilder errorCodeBuilder = new StringBuilder("0x");
    String errorCode;
    ErrorMessage errorMessage = null;
    errorCodeBuilder.append(RandomStringUtils.randomNumeric(10));
    if (throwable != null) {
      String stackTrace = ExceptionUtils.getStackTrace(throwable);
      errorCodeBuilder.append("-");
      errorCodeBuilder.append(DigestUtils.md5Hex(stackTrace.getBytes()));
      errorCode = errorCodeBuilder.toString();
      if (!(logger == null || !logger.isDebugEnabled())) {
        logger.debug(errorCode);
      }
      errorMessage = new ErrorMessage(errorCode, throwable.getMessage());
      return errorMessage;
    }
    errorCode = errorCodeBuilder.toString();
    errorMessage = new ErrorMessage();
    errorMessage.setErrorCode(errorCode);
    return errorMessage;
  }

  public static class ErrorMessage {

    private String errorCode;

    private List<String> errors;

    public ErrorMessage() {
    }

    public ErrorMessage(ErrorMessage errorMessage) {
      this.errors = errorMessage.getErrors();
    }

    public ErrorMessage(List<String> errors) {
      this.errors = errors;
    }

    public ErrorMessage(String error) {
      this(Collections.singletonList(error));
    }

    public ErrorMessage(String errorCode, String... errors) {
      this(Arrays.asList(errors));
      this.errorCode = errorCode;
    }

    public List<String> getErrors() {
      return errors;
    }

    public void setErrors(List<String> errors) {
      this.errors = errors;
    }

    public String getErrorCode() {
      return errorCode;
    }

    public void setErrorCode(String errorCode) {
      this.errorCode = errorCode;
    }
  }

}
