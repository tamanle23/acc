package com.acc.fs.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class FileAttributes {
  Object s3meta;
  String bucket;
  String code;
  String s3endpoint;
  String s3region;
  String rootLocation;
  Long size;
  String contentType;
  String cluster;
}
