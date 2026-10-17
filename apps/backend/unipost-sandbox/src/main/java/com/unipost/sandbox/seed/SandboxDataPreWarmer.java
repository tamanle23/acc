package com.unipost.sandbox.seed;

import com.unipost.domain.billing.TenantBilling;
import com.unipost.repository.jpa.TenantBillingRepository;
import com.unipost.sandbox.config.SandboxProperties;
import com.unipost.tenant.dto.TenantProvisioningRequest;
import com.unipost.tenant.service.TenantProvisioningService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.ApplicationListener;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

/**
 * Pre-warms demonstration data (Acme Corp, schemas, products, orders) in DEV mode upon startup.
 * Skips execution in TEST mode to guarantee pristine isolated state for test slices.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class SandboxDataPreWarmer implements ApplicationListener<ApplicationReadyEvent> {

    private final SandboxProperties properties;
    private final ObjectProvider<TenantBillingRepository> billingRepositoryProvider;
    private final ObjectProvider<TenantProvisioningService> tenantProvisioningServiceProvider;

    public SandboxDataPreWarmer(
            SandboxProperties properties,
            ObjectProvider<TenantBillingRepository> billingRepositoryProvider,
            ObjectProvider<TenantProvisioningService> tenantProvisioningServiceProvider
    ) {
        this.properties = properties;
        this.billingRepositoryProvider = billingRepositoryProvider;
        this.tenantProvisioningServiceProvider = tenantProvisioningServiceProvider;
    }

    @Override
    public void onApplicationEvent(ApplicationReadyEvent event) {
        if (properties.getMode() != SandboxProperties.SandboxMode.DEV) {
            log.info("[SANDBOX-SEED] Test mode detected (mode={}); skipping demo data pre-warming.", properties.getMode());
            return;
        }

        log.info("[SANDBOX-SEED] DEV mode active. Pre-warming demonstration tenants and metadata...");

        // 1. Provision Billing Entitlements for Demonstration Tenants
        TenantBillingRepository billingRepo = billingRepositoryProvider.getIfAvailable();
        if (billingRepo != null) {
            seedTenantBillingIfMissing(billingRepo, "tenant-acme", "ENTERPRISE", "YEARLY", 5000000L);
            seedTenantBillingIfMissing(billingRepo, "tenant-us-east-1", "PRO", "MONTHLY", 1000000L);
        }

        // 2. Provision Acme Corp Schemas and Default Workspace via Blueprint
        TenantProvisioningService provisioningService = tenantProvisioningServiceProvider.getIfAvailable();
        if (provisioningService != null) {
            try {
                TenantProvisioningRequest request = new TenantProvisioningRequest(
                        "tenant-acme",
                        "Acme Corporation",
                        "bp_crm_billing_v1"
                );
                provisioningService.provisionTenant(request);
                log.info("[SANDBOX-SEED] Successfully provisioned demonstration tenant 'tenant-acme' with blueprint 'bp_crm_billing_v1'");
            } catch (Exception e) {
                log.info("[SANDBOX-SEED] Demonstration tenant 'tenant-acme' already provisioned or skipped: {}", e.getMessage());
            }
        }

        log.info("[SANDBOX-SEED] Demonstration dataset pre-warming complete.");
    }

    private void seedTenantBillingIfMissing(TenantBillingRepository repo, String tenantId, String planTier, String cadence, Long amount) {
        try {
            if (repo.findByTenantId(tenantId).isEmpty()) {
                TenantBilling billing = new TenantBilling();
                billing.setTenantId(tenantId);
                billing.setPlanTier(planTier);
                billing.setStatus("ACTIVE");
                billing.setBillingCadence(cadence);
                billing.setAmountPaid(amount);
                billing.setExpiresAt(LocalDateTime.now().plusYears(1));
                repo.save(billing);
                log.info("[SANDBOX-SEED] Pre-warmed TenantBilling record for '{}' with {} tier", tenantId, planTier);
            }
        } catch (Exception e) {
            log.warn("[SANDBOX-SEED] Could not pre-warm TenantBilling for '{}': {}", tenantId, e.getMessage());
        }
    }
}
