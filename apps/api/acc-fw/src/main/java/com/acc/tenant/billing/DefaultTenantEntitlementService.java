package com.acc.tenant.billing;

import com.acc.domain.billing.TenantBilling;
import com.acc.domain.billing.TenantFeature;
import com.acc.repository.jpa.TenantBillingRepository;
import com.acc.repository.jpa.TenantFeatureRepository;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class DefaultTenantEntitlementService implements TenantEntitlementService {

    private final TenantBillingRepository billingRepository;
    private final TenantFeatureRepository featureRepository;

    // Fast in-memory L1 cache: tenantId -> Set of active feature tokens
    private final Map<String, Set<String>> cache = new ConcurrentHashMap<>();

    // Standard feature sets mapped by plan tier
    public static final Set<String> BASIC_FEATURES = Set.of(
            "FEATURE_METADATA_READ",
            "FEATURE_RECORDS_CRUD"
    );

    public static final Set<String> PRO_FEATURES = Set.of(
            "FEATURE_METADATA_READ",
            "FEATURE_RECORDS_CRUD",
            "FEATURE_SCHEMA_STUDIO",
            "FEATURE_PATTERN_C_GRAPH",
            "FEATURE_DATA_EXPORT"
    );

    public static final Set<String> PRO_MAX_FEATURES = Set.of(
            "FEATURE_METADATA_READ",
            "FEATURE_RECORDS_CRUD",
            "FEATURE_SCHEMA_STUDIO",
            "FEATURE_PATTERN_C_GRAPH",
            "FEATURE_DATA_EXPORT",
            "FEATURE_AI_AGENT_MCP",
            "FEATURE_STATE_MACHINE",
            "FEATURE_STREAMING_EXPORT"
    );

    public static final Set<String> ENTERPRISE_FEATURES = Set.of(
            "FEATURE_METADATA_READ",
            "FEATURE_RECORDS_CRUD",
            "FEATURE_SCHEMA_STUDIO",
            "FEATURE_PATTERN_C_GRAPH",
            "FEATURE_DATA_EXPORT",
            "FEATURE_AI_AGENT_MCP",
            "FEATURE_STATE_MACHINE",
            "FEATURE_STREAMING_EXPORT",
            "FEATURE_DEDICATED_REPLICA",
            "FEATURE_ENTERPRISE_SLA",
            "FEATURE_SSO_SAML"
    );

    @Override
    public boolean isFeatureEntitled(String tenantId, String featureKey) {
        if (tenantId == null || "SYSTEM".equalsIgnoreCase(tenantId)) {
            return true; // SYSTEM always entitled to all features
        }

        Set<String> features = getEntitledFeatures(tenantId);
        return features.contains(featureKey);
    }

    @Override
    @Transactional(readOnly = true)
    public Set<String> getEntitledFeatures(String tenantId) {
        if (tenantId == null) {
            return Collections.emptySet();
        }
        if ("SYSTEM".equalsIgnoreCase(tenantId)) {
            return Collections.unmodifiableSet(ENTERPRISE_FEATURES);
        }

        return cache.computeIfAbsent(tenantId, tid -> {
            Set<String> granted = new HashSet<>();

            // 1. Check database records
            List<TenantFeature> entities = featureRepository.findByTenantId(tid);
            LocalDateTime now = LocalDateTime.now();

            for (TenantFeature f : entities) {
                if (Boolean.TRUE.equals(f.getIsEnabled())) {
                    if (f.getExpiresAt() == null || f.getExpiresAt().isAfter(now)) {
                        granted.add(f.getFeatureKey());
                    }
                }
            }

            // 2. If no explicit features found, fallback to billing plan defaults
            if (granted.isEmpty()) {
                Optional<TenantBilling> billingOpt = billingRepository.findByTenantId(tid);
                String plan = billingOpt.map(TenantBilling::getPlanTier).orElse("BASIC");
                if ("ENTERPRISE".equalsIgnoreCase(plan)) {
                    granted.addAll(ENTERPRISE_FEATURES);
                } else if ("PRO_MAX".equalsIgnoreCase(plan)) {
                    granted.addAll(PRO_MAX_FEATURES);
                } else if ("PRO".equalsIgnoreCase(plan)) {
                    granted.addAll(PRO_FEATURES);
                } else {
                    granted.addAll(BASIC_FEATURES);
                }
            }

            return Collections.unmodifiableSet(granted);
        });
    }

    @Override
    @Transactional
    public void activateSubscriptionFromOrder(Long orderCode, Long amountPaid) {
        log.info("Activating subscription for orderCode: {}, amount: {}", orderCode, amountPaid);

        Optional<TenantBilling> billingOpt = billingRepository.findByCurrentOrderCode(orderCode);
        if (billingOpt.isEmpty()) {
            billingOpt = billingRepository.findByPaymentProviderAndCurrentOrderRef("PAYOS", String.valueOf(orderCode));
        }
        if (billingOpt.isEmpty()) {
            log.warn("No tenant billing found for orderCode: {}", orderCode);
            return;
        }

        TenantBilling billing = billingOpt.get();
        billing.setStatus("ACTIVE");
        billing.setAmountPaid(amountPaid != null ? amountPaid : billing.getAmountPaid());

        // Extend expiry based on cadence
        int daysToAdd = "YEARLY".equalsIgnoreCase(billing.getBillingCadence()) ? 365 : 30;
        LocalDateTime baseDate = (billing.getExpiresAt() != null && billing.getExpiresAt().isAfter(LocalDateTime.now()))
                ? billing.getExpiresAt()
                : LocalDateTime.now();
        billing.setExpiresAt(baseDate.plusDays(daysToAdd));
        billingRepository.save(billing);

        // Populate / update feature tokens in UNIPOST_TENANT_FEATURES
        Set<String> targetFeatures;
        if ("ENTERPRISE".equalsIgnoreCase(billing.getPlanTier())) {
            targetFeatures = ENTERPRISE_FEATURES;
        } else if ("PRO_MAX".equalsIgnoreCase(billing.getPlanTier())) {
            targetFeatures = PRO_MAX_FEATURES;
        } else if ("PRO".equalsIgnoreCase(billing.getPlanTier())) {
            targetFeatures = PRO_FEATURES;
        } else {
            targetFeatures = BASIC_FEATURES;
        }

        grantFeatures(billing.getTenantId(), targetFeatures);
        invalidateCache(billing.getTenantId());

        log.info("Tenant {} upgraded to tier {} until {}", billing.getTenantId(), billing.getPlanTier(), billing.getExpiresAt());
    }

    @Override
    @Transactional
    public void grantFeatures(String tenantId, Set<String> featureKeys) {
        LocalDateTime expiry = LocalDateTime.now().plusDays(365);
        for (String key : featureKeys) {
            Optional<TenantFeature> existing = featureRepository.findByTenantIdAndFeatureKey(tenantId, key);
            TenantFeature tf = existing.orElseGet(TenantFeature::new);
            tf.setTenantId(tenantId);
            tf.setFeatureKey(key);
            tf.setIsEnabled(true);
            tf.setExpiresAt(expiry);
            featureRepository.save(tf);
        }
        invalidateCache(tenantId);
    }

    @Override
    public void invalidateCache(String tenantId) {
        cache.remove(tenantId);
    }
}
