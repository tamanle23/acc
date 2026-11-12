package com.acc.core.io.filter;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public abstract class RangeFilter<T> extends BaseFilter {
  boolean leftBoundaryIncluded;
  boolean rightBoundaryIncluded;
  T from;
  T to;
}
