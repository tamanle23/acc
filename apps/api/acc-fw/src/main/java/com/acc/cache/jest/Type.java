package com.acc.cache.jest;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class Type {

  private Index index;

  private String name;
}
