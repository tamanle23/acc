package com.acc.worker.batch;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class BatchItemException extends RuntimeException {

  boolean skip;

  public BatchItemException(boolean skip) {
    super();
    this.skip = skip;
  }
  public BatchItemException(boolean skip, String message) {
    super(message);
    this.skip = skip;
  }
  public BatchItemException(boolean skip,String message, Throwable cause) {
    super(message, cause);
    this.skip = skip;
  }
}
