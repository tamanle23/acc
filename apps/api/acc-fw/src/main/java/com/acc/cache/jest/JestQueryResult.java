package com.acc.cache.jest;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class JestQueryResult<T> {

  private int page;

  private int size;

  private int totalPages;

  private long total;

  private List<T> content;

}
