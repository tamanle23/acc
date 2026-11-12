package com.acc.boot.config.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;
import lombok.Data;

@Data
@Component
@ConfigurationProperties(prefix = "application", ignoreUnknownFields = true)
public class ApplicationProperties {

  private Database database;
  private ConnectionPool cp;
  private Jpa jpa;
  private Security security;
  private ServiceEndpoints serviceEndpoints;
}
