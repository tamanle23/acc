package com.acc.service.shared.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;
import com.acc.service.shared.FileSystemService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import java.io.InputStream;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Component
public class FileSystemServiceImpl implements FileSystemService {

  private static final String URL_PATTERN = "%s/%s";

  @Autowired
  ObjectMapper objectMapper;

  @Autowired
  RestTemplate restTemplate;

  @Value("${application.service.path.fs-upload}")
  String fileUploadPath;

  @Override
  public CompletableFuture<ResponseWrapper<ContextHeader, List<Map>>> upload(String uid, InputStream fileStream, String name, String fieldName, String contentType) throws JsonProcessingException {
    HttpHeaders requestHeaders = new HttpHeaders();
    requestHeaders.setContentType(MediaType.MULTIPART_FORM_DATA);
    requestHeaders.add("Accept", MediaType.APPLICATION_JSON.toString());
    MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

    HttpHeaders partHeaders = new HttpHeaders();
    ContentDisposition contentDisposition = ContentDisposition.builder("form-data")
                                                              .filename(name)
                                                              .name(fieldName)
                                                              .build();
    partHeaders.add(HttpHeaders.CONTENT_DISPOSITION, contentDisposition.toString());
    partHeaders.add(HttpHeaders.CONTENT_TYPE, contentType);

    HttpEntity<InputStreamResource> partEntity = new HttpEntity<>(new InputStreamResource(fileStream), partHeaders);
    body.add("file", partEntity);
    HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, requestHeaders);
    Map<String, String> uriVariables = new HashMap<>();
    uriVariables.put("uid", "null");
    uriVariables.put("overwrite", "overwrite");

    return CompletableFuture.supplyAsync(() -> {
      String responseBodyStr = restTemplate.exchange(fileUploadPath, HttpMethod.POST, requestEntity, String.class, uriVariables).getBody();
      try {
        return this.objectMapper.readValue(responseBodyStr, new TypeReference<ResponseWrapper<ContextHeader, List<Map>>>() {});
      } catch (JsonProcessingException e) {
        throw new RuntimeException("Failed to parse JSON response", e);
      }
    });
  }
}
