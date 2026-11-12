package com.acc.core.io.filter;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.Getter;
import lombok.Setter;

@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "@type",  visible = true)
@JsonSubTypes({
  @JsonSubTypes.Type(value = MatchFilter.class, name = "MatchFilter"),
  @JsonSubTypes.Type(value = IntegerRangeFilter.class, name = "IntegerRangeFilter"),
  @JsonSubTypes.Type(value = DecimalRangeFilter.class, name = "DecimalRangeFilter"),
  @JsonSubTypes.Type(value = DateRangeFilter.class, name = "DateRangeFilter"),
  @JsonSubTypes.Type(value = DateTimeRangeFilter.class, name = "DateTimeRangeFilter"),
})
@Getter
public abstract class BaseFilter {

  @JsonProperty(value = "@type")
  String filterType;
}
