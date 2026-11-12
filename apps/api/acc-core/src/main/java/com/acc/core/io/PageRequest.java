package com.acc.core.io;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@AllArgsConstructor
@Builder
@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public class PageRequest {

  public PageRequest() {
//    this.setOffset((long) (this.getNumber() - 1) * this.getSize());
  }

  int type;
  Integer number;
  int size;
  Long offset;

  public Long getOffset() {
    if(number != null && offset == null) {
      return (long)(number - 1)  * size;
    }
    return offset;
  }
}
