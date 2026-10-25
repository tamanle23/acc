package com.acc.service;

import java.util.Arrays;
import java.util.List;

import org.springframework.cloud.client.DefaultServiceInstance;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.loadbalancer.core.ServiceInstanceListSupplier;

import reactor.core.publisher.Flux;

//@Configuration
public class UserServiceConfiguration {

//  @Bean
//  @Primary
  ServiceInstanceListSupplier serviceInstanceListSupplier() {
    return new CustomServiceInstanceListSupplier("acc-ms-user");
  }
}

class CustomServiceInstanceListSupplier implements ServiceInstanceListSupplier {

  private final String serviceId;

  CustomServiceInstanceListSupplier(String serviceId) {
    this.serviceId = serviceId;
  }

  @Override
  public String getServiceId() {
    return serviceId;
  }

  @Override
  public Flux<List<ServiceInstance>> get() {
    return Flux.just(Arrays.asList(
        new DefaultServiceInstance(serviceId + "1", serviceId, "localhost", 8000, false)));
  }
}
