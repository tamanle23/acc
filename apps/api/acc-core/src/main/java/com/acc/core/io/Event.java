package com.acc.core.io;

import lombok.*;

import java.util.Optional;
import java.util.function.Supplier;

@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class Event<T> {

  private String type;
  private String object;
  private String action;
  private String correlation;
  private T message;

}
