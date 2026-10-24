package com.unipost.repository.jpa;

import com.unipost.domain.billing.TenantBilling;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TenantBillingRepository extends JpaRepository<TenantBilling, String> {
    Optional<TenantBilling> findByCurrentOrderCode(Long currentOrderCode);
    Optional<TenantBilling> findByTenantId(String tenantId);
    Optional<TenantBilling> findByPaymentProviderAndCurrentOrderRef(String paymentProvider, String currentOrderRef);
    Optional<TenantBilling> findByPaymentProviderAndProviderCustomerRef(String paymentProvider, String providerCustomerRef);
}
