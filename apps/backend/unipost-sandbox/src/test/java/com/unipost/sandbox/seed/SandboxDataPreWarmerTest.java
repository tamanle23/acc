package com.unipost.sandbox.seed;

import com.unipost.domain.billing.TenantBilling;
import com.unipost.repository.jpa.TenantBillingRepository;
import com.unipost.sandbox.config.SandboxProperties;
import com.unipost.tenant.dto.TenantProvisioningRequest;
import com.unipost.tenant.service.TenantProvisioningService;
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

        SandboxDataPreWarmer preWarmer = new SandboxDataPreWarmer(properties, billingProvider, provisioningProvider);

        preWarmer.onApplicationEvent(mock(ApplicationReadyEvent.class));

        verifyNoInteractions(billingProvider);
        verifyNoInteractions(provisioningProvider);
    }

    @Test
    @DisplayName("Should seed TenantBilling and provision blueprint when in DEV mode")
    void testSeedInDevMode() {
        SandboxProperties properties = new SandboxProperties();
        properties.setEnabled(true);
        properties.setMode(SandboxProperties.SandboxMode.DEV);

        TenantBillingRepository billingRepo = mock(TenantBillingRepository.class);
        when(billingRepo.findByTenantId("tenant-acme")).thenReturn(Optional.empty());
        when(billingRepo.findByTenantId("tenant-us-east-1")).thenReturn(Optional.empty());

        TenantProvisioningService provisioningService = mock(TenantProvisioningService.class);

        @SuppressWarnings("unchecked")
        ObjectProvider<TenantBillingRepository> billingProvider = mock(ObjectProvider.class);
        when(billingProvider.getIfAvailable()).thenReturn(billingRepo);

        @SuppressWarnings("unchecked")
        ObjectProvider<TenantProvisioningService> provisioningProvider = mock(ObjectProvider.class);
        when(provisioningProvider.getIfAvailable()).thenReturn(provisioningService);

        SandboxDataPreWarmer preWarmer = new SandboxDataPreWarmer(properties, billingProvider, provisioningProvider);

        preWarmer.onApplicationEvent(mock(ApplicationReadyEvent.class));

        // Verify billing records saved
        verify(billingRepo, times(2)).save(any(TenantBilling.class));

        // Verify blueprint provisioned
        verify(provisioningService, times(1)).provisionTenant(any(TenantProvisioningRequest.class));
    }
}
