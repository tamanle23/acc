package com.acc.sandbox.seed;

import com.acc.domain.billing.TenantBilling;
import com.acc.repository.jpa.TenantBillingRepository;
import com.acc.sandbox.config.SandboxProperties;
import com.acc.tenant.dto.TenantProvisioningRequest;
import com.acc.tenant.service.TenantProvisioningService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.event.ApplicationReadyEvent;

import java.util.Optional;

import static org.mockito.Mockito.*;

class SandboxDataPreWarmerTest {

    @Test
    @DisplayName("Should skip pre-warming when in TEST mode")
    void testSkipInTestMode() {
        SandboxProperties properties = new SandboxProperties();
        properties.setEnabled(true);
        properties.setMode(SandboxProperties.SandboxMode.TEST);

        @SuppressWarnings("unchecked")
        ObjectProvider<TenantBillingRepository> billingProvider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<TenantProvisioningService> provisioningProvider = mock(ObjectProvider.class);
        @SuppressWarnings("unchecked")
        ObjectProvider<CmsDataScaffoldingGenerator> cmsProvider = mock(ObjectProvider.class);

        SandboxDataPreWarmer preWarmer = new SandboxDataPreWarmer(properties, billingProvider, provisioningProvider, cmsProvider);

        preWarmer.onApplicationEvent(mock(ApplicationReadyEvent.class));

        verifyNoInteractions(billingProvider);
        verifyNoInteractions(provisioningProvider);
        verifyNoInteractions(cmsProvider);
    }

    @Test
    @DisplayName("Should seed TenantBilling and provision blueprints when in DEV mode")
    void testSeedInDevMode() {
        SandboxProperties properties = new SandboxProperties();
        properties.setEnabled(true);
        properties.setMode(SandboxProperties.SandboxMode.DEV);

        TenantBillingRepository billingRepo = mock(TenantBillingRepository.class);
        when(billingRepo.findByTenantId("tenant-acme")).thenReturn(Optional.empty());
        when(billingRepo.findByTenantId("tenant-us-east-1")).thenReturn(Optional.empty());

        TenantProvisioningService provisioningService = mock(TenantProvisioningService.class);
        CmsDataScaffoldingGenerator cmsGenerator = mock(CmsDataScaffoldingGenerator.class);

        @SuppressWarnings("unchecked")
        ObjectProvider<TenantBillingRepository> billingProvider = mock(ObjectProvider.class);
        when(billingProvider.getIfAvailable()).thenReturn(billingRepo);

        @SuppressWarnings("unchecked")
        ObjectProvider<TenantProvisioningService> provisioningProvider = mock(ObjectProvider.class);
        when(provisioningProvider.getIfAvailable()).thenReturn(provisioningService);

        @SuppressWarnings("unchecked")
        ObjectProvider<CmsDataScaffoldingGenerator> cmsProvider = mock(ObjectProvider.class);
        when(cmsProvider.getIfAvailable()).thenReturn(cmsGenerator);

        SandboxDataPreWarmer preWarmer = new SandboxDataPreWarmer(properties, billingProvider, provisioningProvider, cmsProvider);

        preWarmer.onApplicationEvent(mock(ApplicationReadyEvent.class));

        // Verify billing records saved
        verify(billingRepo, times(2)).save(any(TenantBilling.class));

        // Verify blueprints provisioned (CRM + CMS)
        verify(provisioningService, times(2)).provisionTenant(any(TenantProvisioningRequest.class));

        // Verify CMS data scaffolding invoked
        verify(cmsGenerator, times(1)).scaffoldCmsDataIfMissing();
    }
}
