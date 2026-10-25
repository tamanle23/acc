package com.acc.domain;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public abstract class AbstractEnum<T> {

  private T value;
  private String name;

  public AbstractEnum(T value, String name) {
    this.value = value;
    this.name = name;
  }
}
