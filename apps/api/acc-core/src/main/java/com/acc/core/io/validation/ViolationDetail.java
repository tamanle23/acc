package com.acc.core.io.validation;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Setter
public class ViolationDetail {

  private final Object[] args;
  private final String description;
  private final String key;
  private final Object target;
  private final String field;

  @Builder
  public ViolationDetail(String key, Object[] args, String description, Object target, String field) {
    this.key = key;
    this.args = args;
    this.description = description;
    this.target = target;
    this.field = field;
  }
}
