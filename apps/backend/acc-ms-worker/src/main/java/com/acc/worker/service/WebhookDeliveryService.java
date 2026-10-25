package com.acc.worker.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;

/**
 * Service responsible for delivering HMAC-SHA256 signed webhooks to edge endpoints (e.g. tekgo-ui).
 * <p>
 * Payload signature format:
 * {@code x-acc-signature: HMAC-SHA256(secret, timestamp + "." + body)}
 */
@Slf4j
@Service
public class WebhookDeliveryService {

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    @Value("${application.webhook.secret:acc-webhook-secret-token}")
    private String webhookSecret;

    @Value("${application.webhook.tekgoUrl:http://localhost:3000/api/revalidate}")
    private String tekgoWebhookUrl;

    public WebhookDeliveryService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(5))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    public WebhookDeliveryService(HttpClient httpClient, ObjectMapper objectMapper, String secret, String url) {
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
        this.webhookSecret = secret;
        this.tekgoWebhookUrl = url;
    }

    /**
     * Dispatches edge cache invalidation for a published or mutated slug/tag.
     *
     * @param slug the article slug to revalidate
     * @param tag optional tag to revalidate
     * @return boolean true if successfully delivered with HTTP 200
     */
    public boolean triggerEdgeRevalidation(String slug, String tag) {
        return triggerEdgeRevalidation(slug, tag, null);
    }

    /**
     * Dispatches edge cache invalidation for a published or mutated slug/tag with W3C traceparent propagation.
     *
     * @param slug the article slug to revalidate
     * @param tag optional tag to revalidate
     * @param traceparent optional W3C traceparent header to propagate downstream
     * @return boolean true if successfully delivered with HTTP 200
     */
    public boolean triggerEdgeRevalidation(String slug, String tag, String traceparent) {
        try {
            Map<String, String> payloadMap = new java.util.HashMap<>();
            if (slug != null) payloadMap.put("slug", slug);
            if (tag != null) payloadMap.put("tag", tag);

            String payload = objectMapper.writeValueAsString(payloadMap);
            String timestamp = String.valueOf(Instant.now().getEpochSecond());
            String signature = calculateHmac(webhookSecret, timestamp + "." + payload);

            HttpRequest.Builder requestBuilder = HttpRequest.newBuilder()
                    .uri(URI.create(tekgoWebhookUrl))
                    .timeout(Duration.ofSeconds(5))
                    .header("Content-Type", "application/json")
                    .header("x-acc-signature", signature)
                    .header("x-acc-timestamp", timestamp);

            if (traceparent != null && !traceparent.isBlank()) {
                requestBuilder.header("traceparent", traceparent.trim());
            }

            HttpRequest request = requestBuilder
                    .POST(HttpRequest.BodyPublishers.ofString(payload, StandardCharsets.UTF_8))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() >= 200 && response.statusCode() < 300) {
                log.info("Edge invalidation delivered successfully for slug: {}, tag: {}, status: {}", slug, tag, response.statusCode());
                return true;
            } else {
                log.warn("Edge invalidation failed with HTTP status: {}, body: {}", response.statusCode(), response.body());
                return false;
            }
        } catch (Exception e) {
            log.error("Failed to deliver webhook edge invalidation to {}", tekgoWebhookUrl, e);
            return false;
        }
    }

    public static String calculateHmac(String secret, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] hmacBytes = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hmacBytes);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to calculate HMAC-SHA256 signature", e);
        }
    }
}
