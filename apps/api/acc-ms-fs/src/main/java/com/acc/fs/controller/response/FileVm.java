package com.acc.fs.controller.response;

import java.time.LocalDateTime;

import com.acc.fs.model.FileAttributes;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FileVm {

  Long id;
  String code;
  String uid;
  String description;
  String createdBy;
  LocalDateTime createdDate;
  String lastUpdatedBy;
  LocalDateTime lastUpdatedDate;
  Long version = 0L;
  LocalDateTime deletedDate;

  String rootLocation;
  String extension;
  boolean isPersisted;
  Boolean isDirectory;
  String contentType;
  long size;
  String checksum;
  String name;
  String fullPath;

}
