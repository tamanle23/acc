package com.acc.core.io;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@JsonPropertyOrder({ "status", "headers", "body", "errors"})
@JsonInclude(value = JsonInclude.Include.NON_EMPTY)
@NoArgsConstructor
@Getter
@Setter
public class ResponseWrapper<H, B> {

  private H headers;

  /**
   * The indicator of request processing. There are three types:
   * success,fail,error
   */
  private Status status;

  /** The payload contains return response data */
  private B body;

  /** Errors list */
  private Error[] errors;

  @Builder
  private ResponseWrapper(Status status,H header, B body,Error... errors){
    this.status = status;
    this.body = body;
    this.errors = errors;
    this.headers = header;
  }

  public static <H, B>ResponseWrapper<H, B> create(Status status, H header, B body, Error... errors) {
    return new ResponseWrapper<>(status, header, body, errors);
  }

  public static <B>ResponseWrapper<ContextHeader, B> success() {
    return success(null);
  }

  public static <B>ResponseWrapper<ContextHeader, B> success(ContextHeader header) {
    return success(header, null);
  }

  public static <B>ResponseWrapper<ContextHeader, B> success(B body) {
    return success(null, body);
  }

  public static <B>ResponseWrapper<ContextHeader, B> success(ContextHeader header, B body) {
    return ResponseWrapper.<ContextHeader, B>create(Status.SUCCESS,header, body);
  }

  public static <T>ResponseWrapper<ContextHeader, T> error(Error... errors) {
      return error(null, errors);
  }

  public static <T>ResponseWrapper<ContextHeader, T> error(ContextHeader header, Error... errors) {
    return ResponseWrapper.<ContextHeader, T>create(Status.ERROR, header, null, errors);
  }

  public static <T>ResponseWrapper<ContextHeader, T> fail(Error... errors) {
    return fail(null,errors);
  }

  public static <T>ResponseWrapper<ContextHeader, T> fail(ContextHeader header, Error... errors) {
    return create(Status.FAIL,header, null,errors);
  }
}
