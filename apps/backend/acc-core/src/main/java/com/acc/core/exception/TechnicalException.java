package com.acc.core.exception;

import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TechnicalException extends Exception {

  private static final long serialVersionUID = -8588787648621826829L;

  @Builder
  public TechnicalException(String msg, Exception ex) {
    super(msg,ex);
  }
}
