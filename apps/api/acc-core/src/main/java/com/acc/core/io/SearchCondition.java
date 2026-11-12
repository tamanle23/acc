package com.acc.core.io;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.acc.core.io.filter.BaseFilter;
import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public class SearchCondition {
  String searchTerm;
  PageRequest pageRequest;
  Map<String, String> sortOrders;
  Map<String, BaseFilter> filters;
}
