package com.acc.boot.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration
@Profile("swagger")
public class SwaggerConfig {

  @Value("${spring.application.name:acc}")
  private String applicationName;

  @Bean
  public OpenAPI api() {
    return new OpenAPI()
        .info(new Info()
            .title(applicationName)
            .version("1.0.0")
            .description("API documentation")
            .contact(new Contact().name("tamanle23").email("tamanle23@gmail.com")));
  }
}
