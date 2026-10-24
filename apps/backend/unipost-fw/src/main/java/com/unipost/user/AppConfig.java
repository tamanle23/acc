package com.unipost.user;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.ComponentScan;

import com.unipost.boot.config.BeanNameGenerator;

@ComponentScan(basePackages = { "com.unipost" }, nameGenerator = BeanNameGenerator.class)
@SpringBootConfiguration
@EnableAutoConfiguration
@ConfigurationPropertiesScan
public class AppConfig {
}
