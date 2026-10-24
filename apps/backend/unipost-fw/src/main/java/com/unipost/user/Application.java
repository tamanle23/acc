package com.unipost.user;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.web.servlet.support.SpringBootServletInitializer;

public class Application extends SpringBootServletInitializer{

	public static void main(String[] args) {
		SpringApplication.run(AppConfig.class, args);
	}
}
