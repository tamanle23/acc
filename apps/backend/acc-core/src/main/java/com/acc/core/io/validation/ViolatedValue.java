package com.acc.core.io.validation;

import java.util.Objects;

public class ViolatedValue {
  private final Object value;

  public ViolatedValue(Object value) {
    this.value = value;
  }

  @Override
  public String toString() {
    return Objects.toString(this.value, "");
  }

  public Object value() {
    return this.value;
  }
}
