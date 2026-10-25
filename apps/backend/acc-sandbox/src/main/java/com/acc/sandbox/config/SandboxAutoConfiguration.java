package com.acc.sandbox.config;

import com.acc.sandbox.db.PgLiteDatasourceConfiguration;
import com.acc.sandbox.registry.BackendSandboxRegistry;
import com.acc.sandbox.simulators.InMemoryStorageSimulator;
import com.acc.sandbox.simulators.InMemoryStorageConnector;
import com.acc.sandbox.simulators.MockWebhookDispatcher;
import com.acc.sandbox.simulators.MockWebhookDeliveryService;
import com.acc.sandbox.simulators.PayOsSimulator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Import;

/**
 * Spring Auto-Configuration for the Backend Unified Sandbox Platform.
 * Conditionally activated strictly when application.sandbox.enabled=true.
 * When disabled (or in production), zero beans from this module are registered.
 */
@AutoConfiguration
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
@EnableConfigurationProperties(SandboxProperties.class)
@Import({
        BackendSandboxRegistry.class,
        PayOsSimulator.class,
        InMemoryStorageSimulator.class,
        MockWebhookDispatcher.class,
        PgLiteDatasourceConfiguration.class,
        com.acc.sandbox.aspect.PayOsCheckoutInterceptorAspect.class,
        InMemoryStorageConnector.class,
        MockWebhookDeliveryService.class,
        com.acc.sandbox.auth.SandboxPersonaRegistry.class,
        com.acc.sandbox.auth.SandboxTokenAspect.class,
        com.acc.sandbox.seed.SandboxDataPreWarmer.class
})
public class SandboxAutoConfiguration {

    private static final Logger log = LoggerFactory.getLogger(SandboxAutoConfiguration.class);

    public SandboxAutoConfiguration(SandboxProperties properties) {
        log.info("================================================================");
        log.info("  🚀 UNIPOST BACKEND UNIFIED SANDBOX ACTIVE                     ");
        log.info("  Mode: {}", properties.getMode());
        log.info("  Embedded PGlite: {}", properties.getDatabase().isEmbeddedPglite());
        log.info("  PayOS VietQR Simulator: Auto-confirm={}", properties.getPayos().isAutoConfirmEnabled());
        log.info("================================================================");
    }
}
