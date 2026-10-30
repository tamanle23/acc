package com.acc.aio;

import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.ComponentScan;

import org.springframework.modulith.Modulithic;

import com.acc.boot.config.BeanNameGenerator;

@Modulithic(
    systemName = "acc",
    useFullyQualifiedModuleNames = true
)
@ComponentScan(basePackages = { "com.acc" }, nameGenerator = com.acc.boot.config.BeanNameGenerator.class)
@SpringBootConfiguration
@EnableAutoConfiguration
@ConfigurationPropertiesScan
public class AppConfig {
}
