package com.unipost.worker.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebhookDeliveryServiceTest {

    @Mock
    private HttpClient httpClient;

    @Mock
    private HttpResponse<String> httpResponse;

    private WebhookDeliveryService webhookDeliveryService;

    private static final String SECRET = "test-secret-key-123";
    private static final String WEBHOOK_URL = "http://localhost:3000/api/revalidate";

    @BeforeEach
    void setUp() {
        webhookDeliveryService = new WebhookDeliveryService(
                httpClient,
                new ObjectMapper(),
                SECRET,
                WEBHOOK_URL
        );
    }

    @Test
    void testCalculateHmac_GeneratesValidSha256Hex() {
        String data = "1672531199.{\"slug\":\"test-article\"}";
        String hmac1 = WebhookDeliveryService.calculateHmac(SECRET, data);
        String hmac2 = WebhookDeliveryService.calculateHmac(SECRET, data);

        assertNotNull(hmac1);
        assertEquals(64, hmac1.length()); // SHA-256 hex is 64 characters
        assertEquals(hmac1, hmac2);
    }

    @Test
    void testTriggerEdgeRevalidation_Success() throws Exception {
        when(httpResponse.statusCode()).thenReturn(200);
        doReturn(httpResponse).when(httpClient).send(any(HttpRequest.class), any());

        boolean success = webhookDeliveryService.triggerEdgeRevalidation("test-article", "tech");

        assertTrue(success);

        ArgumentCaptor<HttpRequest> requestCaptor = ArgumentCaptor.forClass(HttpRequest.class);
        verify(httpClient).send(requestCaptor.capture(), any());

        HttpRequest sentRequest = requestCaptor.getValue();
        assertEquals("POST", sentRequest.method());
        assertEquals(WEBHOOK_URL, sentRequest.uri().toString());
        assertTrue(sentRequest.headers().firstValue("x-unipost-signature").isPresent());
        assertTrue(sentRequest.headers().firstValue("x-unipost-timestamp").isPresent());
        assertEquals("application/json", sentRequest.headers().firstValue("Content-Type").orElse(""));
    }

    @Test
    void testTriggerEdgeRevalidation_FailsOn500() throws Exception {
        when(httpResponse.statusCode()).thenReturn(500);
        when(httpResponse.body()).thenReturn("{\"error\":\"Internal Server Error\"}");
        doReturn(httpResponse).when(httpClient).send(any(HttpRequest.class), any());

        boolean success = webhookDeliveryService.triggerEdgeRevalidation("broken-article", null);

        assertFalse(success);
    }
}
