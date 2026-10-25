package com.acc.tenant.billing;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/**
 * Thrown when an active tenant attempts to execute a capability guarded by {@link RequireFeature}
 * that is not currently granted or has expired in UNIPOST_TENANT_FEATURES.
 */
@ResponseStatus(HttpStatus.FORBIDDEN)
public class FeatureNotEntitledException extends RuntimeException {

    private final String featureKey;

    public FeatureNotEntitledException(String featureKey) {
        super("Tenant is not entitled to feature: " + featureKey);
        this.featureKey = featureKey;
    }

    public FeatureNotEntitledException(String featureKey, String message) {
        super(message);
        this.featureKey = featureKey;
    }

    public String getFeatureKey() {
        return featureKey;
    }
}
