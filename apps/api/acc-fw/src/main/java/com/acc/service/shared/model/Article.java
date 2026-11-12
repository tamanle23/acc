package com.acc.service.shared.model;

import lombok.*;

import java.util.List;

@Getter
@Setter
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class Article {
  String code;
  String description;
  String header;
  String summary;
  String content;
  int contentType;
  List<String> tag;
}
