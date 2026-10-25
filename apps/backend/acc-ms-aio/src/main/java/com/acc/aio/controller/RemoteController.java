package com.acc.aio.controller;

import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cloud.client.ServiceInstance;
import org.springframework.cloud.client.discovery.DiscoveryClient;
import org.springframework.cloud.client.loadbalancer.LoadBalanced;
import org.springframework.http.RequestEntity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;


@RestController
@RequestMapping(value = "api/remote")
public class RemoteController {

  @Autowired
  private RestTemplate restTemplate;

  @Autowired
  DiscoveryClient discoveryClient;

  @RequestMapping(method = { RequestMethod.POST })
  public ResponseEntity<?> execute(@RequestBody RemoteRequest request,RequestEntity<?> requestEntity) {
    Optional<ServiceInstance> instanceOptional = discoveryClient.getInstances(request.serviceName).stream().findFirst();
    if(instanceOptional.isPresent()) {
      return restTemplate.exchange(request.serviceName, request.method,null,Object.class);
    }
    return null;
  }

}
