package com.acc.service.query;

import java.util.List;

import lombok.Data;

@Data
public class QueryRequest {
  String key;
  private ValueType type;
  List<QueryPair> queryPairs;
}
