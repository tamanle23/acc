package com.acc.tenant.billing;

import java.util.Set;

/**
 * Service managing dynamic tenant entitlements and in-memory/distributed cache fabric.
 */
public interface TenantEntitlementService {

    /**
     * Checks whether the given tenant currently holds an active, non-expired entitlement.
     */
    boolean isFeatureEntitled(String tenantId, String featureKey);

    /**
     * Retrieves all active feature keys currently entitled to the tenant.
     */
    Set<String> getEntitledFeatures(String tenantId);

    /**
     * Activates or extends tenant subscription from order code upon receiving verified webhook payment.
     */
    void activateSubscriptionFromOrder(Long orderCode, Long amountPaid);

    /**
     * Provisions or overrides active features for a tenant.
     */
    void grantFeatures(String tenantId, Set<String> featureKeys);

    /**
     * Invalidates cached entitlements for a tenant.
     */
    void invalidateCache(String tenantId);
}
