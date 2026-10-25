package com.acc.aio.controller;

import org.springframework.http.HttpMethod;

public class RemoteRequest{
  String serviceName;
  HttpMethod method;
  String uri;
  Object payload;
  public String getServiceName() {
    return serviceName;
  }
  public void setServiceName(String serviceName) {
    this.serviceName = serviceName;
  }
  public HttpMethod getMethod() {
    return method;
  }
  public void setMethod(HttpMethod method) {
    this.method = method;
  }
  public String getUri() {
    return uri;
  }
  public void setUri(String uri) {
    this.uri = uri;
  }
  public Object getPayload() {
    return payload;
  }
  public void setPayload(Object payload) {
    this.payload = payload;
  }
}