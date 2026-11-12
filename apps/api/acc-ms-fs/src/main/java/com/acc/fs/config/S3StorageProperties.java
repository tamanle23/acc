package com.acc.fs.config;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Getter
@Setter
@Component
@ConditionalOnProperty(prefix = "application.storage", value = "s3")
@ConfigurationProperties("application.storage.s3")
public class S3StorageProperties {

  private String defaultBucket;
  private String url;
  private String region;
  private String key;
  private String secret;

}
