package com.acc.boot.config;

import javax.sql.DataSource;

import com.acc.core.helper.GenerationHelper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.MessageSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableMBeanExport;
import org.springframework.context.annotation.Primary;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.filter.RequestContextFilter;
import org.springframework.web.servlet.i18n.LocaleChangeInterceptor;
import org.springframework.web.servlet.i18n.SessionLocaleResolver;

import com.acc.core.context.Context;
import com.acc.fw.authentication.LoginAttemptFilter;
import com.acc.fw.core.jwt.JwtTokenHelper;
import com.acc.fw.helper.LocaleHelpers;
import com.acc.fw.i18n.InitializableMessageSource;
import com.acc.fw.i18n.JdbcMessageProvider;
import com.acc.fw.i18n.MessageProvider;
import com.acc.fw.tracking.ClientAddressMDCFilter;
import com.acc.fw.tracking.ContextFilter;
import com.acc.fw.tracking.PrincipalMDCFilter;
import com.acc.presentation.context.ApplicationContextListener;
import com.acc.service.user.LoginAttemptService;

@Configuration
@EnableMBeanExport
public class CommonConfiguration {

  @Bean
  public SessionLocaleResolver localeResolver() {
    SessionLocaleResolver localeResolver = new SessionLocaleResolver();
    localeResolver.setDefaultLocale(LocaleHelpers.toLocale("en_US"));
    return localeResolver;
  }

  @Bean
  public LocaleChangeInterceptor localeChangeInterceptor() {
    LocaleChangeInterceptor localeChangeInterceptor = new LocaleChangeInterceptor();
    localeChangeInterceptor.setParamName("language");
    return localeChangeInterceptor;
  }

  @Bean
  @Order(Ordered.HIGHEST_PRECEDENCE)
  public org.springframework.web.filter.CharacterEncodingFilter characterEncodingFilter() {
    org.springframework.web.filter.CharacterEncodingFilter characterEncodingFilter = new org.springframework.web.filter.CharacterEncodingFilter();
    characterEncodingFilter.setForceEncoding(true);
    characterEncodingFilter.setEncoding("UTF-8");
    return characterEncodingFilter;
  }

  @Bean
  public MessageProvider messageProvider(DataSource dataSource) {
    return new JdbcMessageProvider(dataSource);
  }

  @Bean
  @Primary
  MessageSource messageSource() {
    return new InitializableMessageSource();
  }

  @Bean
  public ApplicationContextListener contextListener() {
    return new ApplicationContextListener();
  }

  @Bean
  public PasswordEncoder passwordEncoder() {
    BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder();
    return passwordEncoder;
  }

  @Bean
  public JwtTokenHelper jwtTokenHelper() {
    JwtTokenHelper jwtTokenHelper = new JwtTokenHelper();
    return jwtTokenHelper;
  }

  @Bean
  public FilterRegistrationBean loginAttemptFilter(LoginAttemptService loginAttemptService) {
    FilterRegistrationBean filter = new FilterRegistrationBean(new LoginAttemptFilter(loginAttemptService));
    filter.setOrder(Ordered.HIGHEST_PRECEDENCE+1);
    return filter;
  }


  @Bean
  public FilterRegistrationBean traceServletRequestFilter(@Autowired Context contextHelper,@Value("${spring.application.name}") String applicationName) {
    FilterRegistrationBean filter = new FilterRegistrationBean(new ContextFilter(contextHelper,applicationName));
    filter.setOrder(Ordered.HIGHEST_PRECEDENCE);
    return filter;
  }

  @Bean
  @ConditionalOnMissingBean(RequestContextFilter.class)
  public FilterRegistrationBean requestContextFilter(){
    FilterRegistrationBean requestContextFilter = new FilterRegistrationBean();
    RequestContextFilter filter = new RequestContextFilter();
    filter.setThreadContextInheritable(true);
    requestContextFilter.setFilter(filter);
    return requestContextFilter;
  }

  @Bean
  public PrincipalMDCFilter principalMDCFilter() {
    PrincipalMDCFilter filter = new PrincipalMDCFilter();
    return filter;
  }

  @Bean
  public ClientAddressMDCFilter clientAddressMDCFilter() {
    ClientAddressMDCFilter filter = new ClientAddressMDCFilter();
    return filter;
  }

  @Bean
  public GenerationHelper generationHelper() {
    GenerationHelper generationHelper = new GenerationHelper();
    return generationHelper;
  }
}
