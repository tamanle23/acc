package com.acc.cache.jest;

import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
@AllArgsConstructor
public class Index {

  private String name;

  private Map<String, Object> parameterMap;

  private String configurationJson;
}
