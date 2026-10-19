package com.unipost.sandbox.simulators;

import com.unipost.sandbox.config.SandboxProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class PayOsSimulatorTest {

    private PayOsSimulator simulator;
    private SandboxProperties properties;

    @BeforeEach
    void setUp() {
        properties = new SandboxProperties();
        properties.setEnabled(true);
        properties.setMode(SandboxProperties.SandboxMode.TEST);
        properties.getPayos().setAutoConfirmEnabled(false); // disable automatic async callback for unit tests
        simulator = new PayOsSimulator(properties);
    }

    @Test
    @DisplayName("Should create simulated order with PENDING status")
    void shouldCreateOrder() {
        PayOsSimulator.SimulatedOrder order = simulator.createOrder(
                123456L,
                299000,
                "UPGRADE PRO",
                "tenant-acme",
                "PRO"
        );

        assertNotNull(order);
        assertEquals(123456L, order.orderCode());
        assertEquals("PENDING", order.status());
        assertEquals("tenant-acme", order.tenantId());

        Optional<PayOsSimulator.SimulatedOrder> fetched = simulator.getOrder(123456L);
        assertTrue(fetched.isPresent());
        assertEquals(299000, fetched.get().amount());
    }

    @Test
    @DisplayName("Should generate authentic HMAC-SHA256 signature for payment data")
    void shouldGenerateHmacSignature() {
        Map<String, Object> data = Map.of(
                "orderCode", 999111L,
                "amount", 100000,
                "description", "TEST",
                "code", "00"
        );
        String key = "test-checksum-key-12345";
        String sig1 = simulator.computeSignature(data, key);
        String sig2 = simulator.computeSignature(data, key);

        assertNotNull(sig1);
        assertEquals(64, sig1.length()); // SHA256 hex is 64 characters
        assertEquals(sig1, sig2, "HMAC must be deterministic");
    }

    @Test
    @DisplayName("Should update status and clear on reset")
    void shouldResetState() {
        simulator.createOrder(101L, 50000, "DESC", "tid-1", "PRO");
        assertEquals(1, (int) simulator.getDiagnostics().get("totalOrders"));

        simulator.reset();
        assertEquals(0, (int) simulator.getDiagnostics().get("totalOrders"));
        assertTrue(simulator.getOrder(101L).isEmpty());
    }
}
