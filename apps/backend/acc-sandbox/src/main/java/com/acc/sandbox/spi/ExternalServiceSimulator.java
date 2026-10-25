package com.acc.sandbox.spi;

import java.util.Map;

/**
 * Universal SPI strategy for any simulated external service boundary in the Backend Sandbox.
 */
public interface ExternalServiceSimulator {

    /**
     * Unique identifier for this simulator (e.g. "payos-vietqr", "inmemory-s3", "mock-webhook").
     */
    String getId();

    /**
     * Human-readable name.
     */
    String getName();

    /**
     * Reset in-memory simulated state (e.g. transaction ledgers, uploaded files).
     */
    void reset();

    /**
     * Diagnostic metadata regarding current state and operation counts.
     */
    Map<String, Object> getDiagnostics();
}
