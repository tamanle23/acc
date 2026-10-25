package com.acc.boot.config;

import java.util.Collections;

import com.acc.core.context.Context;
import com.acc.fw.core.jwt.JwtTokenHelper;
import feign.RequestInterceptor;
import feign.RequestTemplate;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.BufferingClientHttpRequestFactory;
import org.springframework.http.client.HttpComponentsClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Configuration
public class WebClientConfiguration {

  @Bean
  @LoadBalanced
  public RestTemplate getRestClient() {
      RestTemplate restClient = new RestTemplate(new BufferingClientHttpRequestFactory(new HttpComponentsClientHttpRequestFactory()));
      restClient.setInterceptors(Collections.singletonList((request, body, execution) -> {
          return execution.execute(request, body);
      }));
      return restClient;
  }

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
}
