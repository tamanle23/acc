package com.unipost.sandbox.simulators;

import com.unipost.sandbox.config.SandboxProperties;
import com.unipost.sandbox.spi.ExternalServiceSimulator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;

/**
 * In-memory simulator for PayOS VietQR payments.
 * Simulates order registration and schedules realistic or instant webhook callbacks
 * with authentic HMAC-SHA256 signatures to the standard webhook handler.
 */
@Component
public class PayOsSimulator implements ExternalServiceSimulator {

    private static final Logger log = LoggerFactory.getLogger(PayOsSimulator.class);

    private final SandboxProperties properties;
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${application.payos.checksum-key:a6b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8}")
    private String checksumKey;

    @Value("${server.port:8000}")
    private int serverPort;

    private final Map<Long, SimulatedOrder> orders = new ConcurrentHashMap<>();
    private final List<Map<String, Object>> deliveredWebhooks = new CopyOnWriteArrayList<>();

    public PayOsSimulator(SandboxProperties properties) {
        this.properties = properties;
    }

    public record SimulatedOrder(
            long orderCode,
            int amount,
            String description,
            String tenantId,
            String targetTier,
            String status,
            LocalDateTime createdAt
    ) {}

    @Override
    public String getId() {
        return "payos-vietqr";
    }

    @Override
    public String getName() {
        return "PayOS VietQR Payment Gateway Simulator";
    }

    @Override
    public void reset() {
        orders.clear();
        deliveredWebhooks.clear();
        log.info("PayOsSimulator state reset.");
    }

    @Override
    public Map<String, Object> getDiagnostics() {
        return Map.of(
                "totalOrders", orders.size(),
                "deliveredWebhooks", deliveredWebhooks.size(),
                "pendingOrders", orders.values().stream().filter(o -> "PENDING".equals(o.status())).count(),
                "paidOrders", orders.values().stream().filter(o -> "PAID".equals(o.status())).count()
        );
    }

    /**
     * Registers a new simulated checkout order and schedules payment confirmation.
     */
    public SimulatedOrder createOrder(long orderCode, int amount, String description, String tenantId, String targetTier) {
        SimulatedOrder order = new SimulatedOrder(orderCode, amount, description, tenantId, targetTier, "PENDING", LocalDateTime.now());
        orders.put(orderCode, order);
        log.info("Simulated PayOS order registered: orderCode={}, amount={}, tenantId={}", orderCode, amount, tenantId);

        if (properties.getPayos().isAutoConfirmEnabled()) {
            long delay = properties.getMode() == SandboxProperties.SandboxMode.TEST ? 0L : properties.getPayos().getAutoConfirmDelayMs();
            schedulePaymentConfirmation(orderCode, delay);
        }
        return order;
    }

    public void schedulePaymentConfirmation(long orderCode, long delayMs) {
        if (delayMs <= 0) {
            triggerPaymentWebhook(orderCode);
        } else {
            scheduler.schedule(() -> triggerPaymentWebhook(orderCode), delayMs, TimeUnit.MILLISECONDS);
        }
    }

    /**
     * Fires payment webhook with authentic HMAC-SHA256 signature to the standard endpoint.
     */
    public boolean triggerPaymentWebhook(long orderCode) {
        SimulatedOrder order = orders.get(orderCode);
        if (order == null) {
            log.warn("Cannot trigger webhook for unknown orderCode={}", orderCode);
            return false;
        }

        try {
            Map<String, Object> paymentData = new LinkedHashMap<>();
            paymentData.put("orderCode", orderCode);
            paymentData.put("amount", order.amount());
            paymentData.put("description", order.description());
            paymentData.put("accountNumber", "999888777");
            paymentData.put("reference", "SIM-" + System.currentTimeMillis());
            paymentData.put("transactionDateTime", "2026-10-17 12:00:00");
            paymentData.put("currency", "VND");
            paymentData.put("paymentLinkId", "plink-" + orderCode);
            paymentData.put("code", "00");
            paymentData.put("desc", "success");

            String signature = computeSignature(paymentData, checksumKey);

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("code", "00");
            payload.put("desc", "success");
            payload.put("data", paymentData);
            payload.put("signature", signature);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(payload, headers);

            String webhookUrl = "http://localhost:" + serverPort + "/api/v1/billing/payos/webhook";
            restTemplate.postForEntity(webhookUrl, request, String.class);

            orders.put(orderCode, new SimulatedOrder(order.orderCode(), order.amount(), order.description(), order.tenantId(), order.targetTier(), "PAID", order.createdAt()));
            deliveredWebhooks.add(payload);
            log.info("Simulated PayOS webhook delivered successfully for orderCode={}", orderCode);
            return true;
        } catch (Exception e) {
            log.warn("Failed to dispatch simulated webhook to local server (may not be listening during slice tests): {}", e.getMessage());
            // Still update status so unit tests can assert simulator state
            orders.put(orderCode, new SimulatedOrder(order.orderCode(), order.amount(), order.description(), order.tenantId(), order.targetTier(), "PAID", order.createdAt()));
            return false;
        }
    }

    public List<Map<String, Object>> getDeliveredWebhooks() {
        return Collections.unmodifiableList(deliveredWebhooks);
    }

    public Optional<SimulatedOrder> getOrder(long orderCode) {
        return Optional.ofNullable(orders.get(orderCode));
    }

    public String computeSignature(Map<String, Object> data, String key) {
        try {
            List<String> sortedKeys = new ArrayList<>(data.keySet());
            Collections.sort(sortedKeys);
            StringBuilder sb = new StringBuilder();
            for (String k : sortedKeys) {
                if (sb.length() > 0) sb.append("&");
                sb.append(k).append("=").append(data.get(k));
            }
            Mac hmac = Mac.getInstance("HmacSHA256");
            hmac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = hmac.doFinal(sb.toString().getBytes(StandardCharsets.UTF_8));
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (Exception e) {
            throw new RuntimeException("HMAC computation failed", e);
        }
    }
}
