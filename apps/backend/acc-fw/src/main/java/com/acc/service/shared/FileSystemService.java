package com.acc.service.shared;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;

import java.io.InputStream;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

public interface FileSystemService {

  CompletableFuture<ResponseWrapper<ContextHeader, List<Map>>> upload(String uid, InputStream fileStream, String name, String fieldName, String contentType) throws JsonProcessingException;
}
