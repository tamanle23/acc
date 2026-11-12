package com.acc.core.exception;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import com.acc.core.io.Error;
import com.acc.core.io.validation.ViolationDetail;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class BusinessException extends RuntimeException {

  private static final long serialVersionUID = 2170928867757044894L;

  private final List<Error> errors = new ArrayList<>();

  private boolean isServerSide;
  private Integer httpCode;

  public BusinessException setHttpCode(Integer httpCode) {
    this.httpCode = httpCode;
    return this;
  }

  public BusinessException(Error error) {
    super();
    if (error != null) {
      this.errors.add(error);
    }
  }

  public BusinessException(Exception exception) {
    super(exception);
  }

  public BusinessException(String message) {
    super(message);
  }

  public BusinessException(List<Error> errors) {
    super();
    this.errors.addAll(errors);
  }

  public BusinessException() {
    super();
  }

  public BusinessException add(ErrorCodes errorCodes) {
    this.errors.add(Error.builder().errorCodes(errorCodes).build());
    return this;
  }

  public BusinessException add(ViolationDetail v) {
    this.errors.add(Error.builder()
      .errorCodes(ErrorCodes.FAIL_VALIDATION)
      .detail(v)
      .build());
    return this;
  }

  public BusinessException add(List<ViolationDetail> violationDetails) {
    this.errors.addAll(Optional.ofNullable(violationDetails)
               .map(List::stream)
               .orElse(Stream.empty())
               .map(v -> Error.builder()
                              .errorCodes(ErrorCodes.FAIL_VALIDATION)
                              .detail(v)
                              .build())
               .collect(Collectors.toList()));
    return this;
  }

  public void throwEx() {
    this.fillInStackTrace();
    throw this;
  }

  public void throwEx(Throwable ex) {
    this.fillInStackTrace();
    this.addSuppressed(ex);
    throw this;
  }

  public BusinessException addAll(List<ErrorCodes> errors) {
    this.errors.addAll(errors.stream().map(errorCodes -> Error.builder().errorCodes(errorCodes).build()).collect(Collectors.toList()));
    return this;
  }

  public BusinessException addMessages(ErrorCodes errorCodes, String... errorMessages) {
    this.errors.addAll(Arrays.stream(errorMessages).map(message -> Error.builder().code(errorCodes.name()).message(message).build())
        .collect(Collectors.toList()));
    return this;
  }

  public static BusinessException create() {
    return BusinessException.create(true);
  }

  public static BusinessException create(boolean isServerSide) {
    BusinessException ex = new BusinessException();
    ex.setServerSide(isServerSide);
    return ex;
  }

  public static BusinessException create(Exception rootException) {
    return new BusinessException(rootException);
  }
}
