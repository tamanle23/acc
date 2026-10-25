package com.acc.boot.config;

import java.io.File;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import java.util.List;

import jakarta.inject.Inject;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.acc.fw.controller.resolver.JsonParamArgumentResolver;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.converter.xml.Jaxb2RootElementHttpMessageConverter;
import org.springframework.security.web.method.annotation.AuthenticationPrincipalArgumentResolver;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.*;

import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import com.acc.domain.constant.SystemConstant;
import com.acc.fw.i18n.CustomLocalValidatorFactoryBean;
import com.acc.presentation.codelist.CodelistFactory;

@Configuration
public class WebConfiguration implements WebMvcConfigurer {

  @Inject
  MessageSource messageSource;

  @Override
  public void addResourceHandlers(final ResourceHandlerRegistry registry) {

    registry.addResourceHandler("/resources/img/**").addResourceLocations("classpath:resources/img/").setCachePeriod(60 * 60 * 24 * 365);
    registry.addResourceHandler("/resources/fonts/**").addResourceLocations("classpath:resources/fonts/").setCachePeriod(60 * 60 * 24 * 365);
    registry.addResourceHandler("/resources/qr/**").addResourceLocations("file:"+SystemConstant.PATH_QR_CODE+File.separator).setCachePeriod(60 * 60 * 24 * 365);
    registry.addResourceHandler("/resources/**").addResourceLocations("classpath:resources/");

  }


//  @Override
//  public void configureMessageConverters(List<HttpMessageConverter<?>> converters) {
//    converters.add(new StringHttpMessageConverter());
//    super.configureMessageConverters(converters);
//  }

  @Bean
  public Jaxb2RootElementHttpMessageConverter xmlMessageConverter() {
    Jaxb2RootElementHttpMessageConverter xmlConverter = new Jaxb2RootElementHttpMessageConverter();
    return xmlConverter;
  }


  @Bean
  @Primary
  public LocalValidatorFactoryBean getValidator() {
    CustomLocalValidatorFactoryBean validator= new CustomLocalValidatorFactoryBean();
    validator.setValidationMessageSource(messageSource);
    return validator;
  }

  @Bean
  public AuthenticationPrincipalArgumentResolver authenticationPrincipalArgumentResolver(){
    return new AuthenticationPrincipalArgumentResolver();
  }

  @Bean
  public JsonParamArgumentResolver jsonParamArgumentResolver() {
    return new JsonParamArgumentResolver();
  }
  @Override
  public void addArgumentResolvers(List<HandlerMethodArgumentResolver> argumentResolvers) {
    argumentResolvers.add(authenticationPrincipalArgumentResolver());
    argumentResolvers.add(jsonParamArgumentResolver());
  }

  @Override
  public void addInterceptors(InterceptorRegistry registry) {
  }

  @Bean
  @Primary
  public com.fasterxml.jackson.databind.ObjectMapper objectMapper() {
    com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
    mapper.setDateFormat(new java.text.SimpleDateFormat(SystemConstant.ISO_DATE_FORMAT));
    com.fasterxml.jackson.datatype.jsr310.JavaTimeModule javaTimeModule = new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule();
    javaTimeModule.addSerializer(java.time.LocalDate.class, new LocalDateSerializer(DateTimeFormatter.ofPattern(SystemConstant.ISO_DATE_FORMAT).withResolverStyle(ResolverStyle.SMART)));
    javaTimeModule.addSerializer(java.time.LocalDateTime.class, new LocalDateTimeSerializer(DateTimeFormatter.ofPattern(SystemConstant.ISO_DATE_TIME_FORMAT).withResolverStyle(ResolverStyle.SMART)));
    mapper.registerModule(javaTimeModule);
    mapper.setSerializationInclusion(JsonInclude.Include.NON_NULL);
    return mapper;
  }

  @Bean
  public CodelistFactory codelistFactory(){
    return new CodelistFactory();
  }

//  @Override
//  public
//  void configureContentNegotiation(final ContentNegotiationConfigurer configurer) {
//      configurer.favorPathExtension(false);
//  }
}
