package com.acc.service;

import org.springframework.cloud.loadbalancer.annotation.LoadBalancerClient;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.Configuration;

@Configuration
@EnableFeignClients
@LoadBalancerClient(name = "acc-ms-aio", configuration = UserServiceConfiguration.class)
public class RestClientConfiguration {
}
