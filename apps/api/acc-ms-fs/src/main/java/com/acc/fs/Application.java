package com.acc.fs;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

public class Application extends SpringBootServletInitializer{

  public static void main(String[] args) {
    SpringApplication.run(AppConfig.class, args);
  }

//  @Bean(name = "multipartResolver")
//  public CommonsMultipartResolver getResolver() throws IOException {
//    CommonsMultipartResolver resolver = new CommonsMultipartResolver();
//
//    // Set the maximum allowed size (in bytes) for each individual file.
//    resolver.setMaxUploadSizePerFile(1242880000);// 5MB
//
//    // You may also set other available properties.
//
//    return resolver;
//  }
}
