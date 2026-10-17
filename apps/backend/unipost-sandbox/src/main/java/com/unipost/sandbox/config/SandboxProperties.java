package com.unipost.sandbox.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for the Backend Unified Sandbox.
 */
@Getter
@Setter
@ConfigurationProperties(prefix = "application.sandbox")
public class SandboxProperties {

    /**
     * Master toggle. When false (default), zero sandbox beans are registered.
     */
    private boolean enabled = false;

    /**
     * Mode: "DEV" (local file-backed DB, persistent, realistic 2s delay) or
     * "TEST" (in-memory DB, ephemeral, 0ms delay).
     */
    private SandboxMode mode = SandboxMode.DEV;

    /**
     * PayOS VietQR simulation configuration.
     */
    private PayOsSimulationProperties payos = new PayOsSimulationProperties();

    /**
     * Database simulation configuration.
     */
    private DatabaseSimulationProperties database = new DatabaseSimulationProperties();

    /**
     * DEV mode specific options (e.g., pristine vs persistent baseline).
     */
    private DevSimulationProperties dev = new DevSimulationProperties();

    public boolean isDevMode() {
        return mode == SandboxMode.DEV;
    }

    public boolean isTestMode() {
        return mode == SandboxMode.TEST;
    }

    public enum SandboxMode {
        DEV,
        TEST
    }

    @Getter
    @Setter
    public static class PayOsSimulationProperties {
        private boolean autoConfirmEnabled = true;
        private long autoConfirmDelayMs = 2000L;
    }

    @Getter
    @Setter
    public static class DatabaseSimulationProperties {
        private boolean embeddedPglite = true;
        private String devStoragePath = "tmp/db/pglite-sandbox";
    }

    @Getter
    @Setter
    public static class DevSimulationProperties {
        /**
         * When true in DEV mode, persistent scratch storage is wiped on boot to guarantee a pristine baseline.
         * When false (default), data persists across server restarts.
         */
        private boolean pristine = false;
    }
}
