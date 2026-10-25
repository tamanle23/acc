package com.acc.fs;


import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.ComponentScan;

import com.acc.boot.config.BeanNameGenerator;
import com.acc.fs.connector.StorageServiceFactory;

@ComponentScan(basePackages = { "com.acc" }, nameGenerator = BeanNameGenerator.class)
@SpringBootConfiguration
@EnableAutoConfiguration
@ConfigurationPropertiesScan
public class AppConfig {


  @Bean
  CommandLineRunner init(final StorageServiceFactory storageServiceFactory) {
      return new CommandLineRunner(){
          @Override
          public void run(String... args) throws Exception {
              //storageService.deleteAll();
          }};

  }
}
