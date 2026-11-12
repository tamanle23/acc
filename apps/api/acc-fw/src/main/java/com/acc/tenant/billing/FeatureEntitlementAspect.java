package com.acc.tenant.billing;

import com.acc.fw.tenancy.TenantContextHolder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Spring Aspect enforcing dynamic feature entitlements declared with {@link RequireFeature}.
 */
@Slf4j
@Aspect
@Component
@Order(10)
@RequiredArgsConstructor
public class FeatureEntitlementAspect {

    private final TenantEntitlementService entitlementService;

    @Around("@annotation(requireFeature) || @within(requireFeature)")
    public Object enforceFeatureEntitlement(ProceedingJoinPoint joinPoint, RequireFeature requireFeature) throws Throwable {
        String featureKey = requireFeature.value();
        String currentTenant = TenantContextHolder.getTenantId();

        // 1. Bypass check if SYSTEM tenant or if no tenant context is set (e.g. public endpoints)
        if (currentTenant == null || "SYSTEM".equalsIgnoreCase(currentTenant)) {
            return joinPoint.proceed();
        }

        // 2. Validate tenant entitlement
        boolean entitled = entitlementService.isFeatureEntitled(currentTenant, featureKey);
        if (!entitled) {
            log.warn("Access denied for tenant [{}] on feature [{}] in method [{}]",
                    currentTenant, featureKey, joinPoint.getSignature().toShortString());
            throw new FeatureNotEntitledException(featureKey,
                    "Access denied: Tenant [" + currentTenant + "] is not entitled to premium feature [" + featureKey + "]. Upgrade to Pro/Pro Max to unlock.");
        }

        return joinPoint.proceed();
    }
}
