package com.acc.core.io;

import java.util.Optional;
import java.util.function.Supplier;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Builder
@AllArgsConstructor
@NoArgsConstructor
@Data
public class RequestWrapper<H, B> {

  private H header;
  private B body;

  public static <H>RequestWrapper<H, Void> create(H header) {
    return create(header, null);
  }

  public static <H,B>RequestWrapper<H, B> create(H header, B body) {
    return RequestWrapper.<H,B>builder()
                         .header(header)
                         .body(body)
                         .build();
  }

  public static <H,B>RequestWrapper<H, B> create(H header, Supplier<B> bodySuplier) {
    return RequestWrapper.<H,B>builder()
                         .header(header)
                         .body(Optional.ofNullable(bodySuplier).map(Supplier::get).orElse(null))
                         .build();
  }
}
