package com.acc.fw.client.interceptor;

import jakarta.servlet.http.Cookie;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.acc.core.context.Context;
import com.acc.fw.core.jwt.JwtTokenHelper;

import feign.RequestInterceptor;
import feign.RequestTemplate;

@Component
public class FeignContextInterceptor implements RequestInterceptor {

  @Autowired
  Context context;

  @Autowired
  JwtTokenHelper jwtTokenHelper;

  @Override
  public void apply(RequestTemplate requestTemplate) {
    if(StringUtils.isNoneBlank(context.getKey())) {
      requestTemplate.header("Authorization", String.format("Bearer %s", context.getKey()));
    }
    if(context.getHeader() != null)
      requestTemplate.header("User-Agent", context.getHeader().getClientType());
  }

}
