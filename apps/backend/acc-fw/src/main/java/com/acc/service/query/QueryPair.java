package com.acc.service.query;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class QueryPair {
  private MergeOperation mergeOperation;
  private QueryOperation operation;
  private String value;
  
}
