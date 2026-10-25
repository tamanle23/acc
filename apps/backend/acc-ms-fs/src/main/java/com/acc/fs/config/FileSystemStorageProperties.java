package com.acc.fs.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import lombok.Data;

@Data
@Component
@ConfigurationProperties("application.storage.file-system")
public class FileSystemStorageProperties {
  /**
   * Folder location for storing files
   */
  private String location = "upload-dir";
  private String cluster = "default";
}
