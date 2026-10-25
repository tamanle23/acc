package com.acc.service.shared.impl;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.core.io.ContextHeader;
import com.acc.core.io.ResponseWrapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.RestTemplate;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class FileSystemServiceImplTest {

    @Mock
    private RestTemplate restTemplate;

    @Mock
    private ObjectMapper objectMapper;

    @InjectMocks
    private FileSystemServiceImpl fileSystemService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(fileSystemService, "fileUploadPath", "http://localhost/upload");
    }

    @Test
    void testUploadPerformanceAsync() throws JsonProcessingException, ExecutionException, InterruptedException {
        // Setup
        String mockResponse = "{\"status\":\"success\"}";
        when(restTemplate.exchange(
                eq("http://localhost/upload"),
                eq(HttpMethod.POST),
                any(HttpEntity.class),
                eq(String.class),
                any(Map.class)))
                .thenAnswer(invocation -> {
                    // Simulate long running blocking network call
                    Thread.sleep(250);
                    return ResponseEntity.ok(mockResponse);
                });

        when(objectMapper.readValue(eq(mockResponse), any(TypeReference.class)))
                .thenReturn(new ResponseWrapper<ContextHeader, List<Map>>());

        InputStream inputStream = new ByteArrayInputStream("dummy".getBytes());

        long startTime = System.currentTimeMillis();

        // Act - Call the method which should return immediately since it's async
        CompletableFuture<ResponseWrapper<ContextHeader, List<Map>>> future = fileSystemService.upload("uid", inputStream, "name", "field", "text/plain");

        long timeToReturn = System.currentTimeMillis() - startTime;
        System.out.println("Time to return CompletableFuture: " + timeToReturn + " ms");

        // Assert
        // The return time should be much less than the 250ms simulated delay, freeing the caller thread (e.g. servlet thread)
        assertTrue(timeToReturn < 150);

        // Wait for the result to make sure it functions correctly
        ResponseWrapper<ContextHeader, List<Map>> result = future.get();
        assertNotNull(result);
        System.out.println("Total time including future.get(): " + (System.currentTimeMillis() - startTime) + " ms");
    }
}
