package com.acc.fs.controller.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.NoArgsConstructor;

import java.util.Map;

@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Link {
  String path;
  Map<String, Object> headers;
}
