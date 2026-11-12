package com.acc.worker;


import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.ComponentScan;

import com.acc.boot.config.BeanNameGenerator;

@ComponentScan(basePackages = { "com.acc" }, nameGenerator = BeanNameGenerator.class)
@SpringBootConfiguration
@EnableAutoConfiguration
@ConfigurationPropertiesScan
public class AppConfig {

}
