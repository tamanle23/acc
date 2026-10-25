package com.acc.tenant.billing;

import java.lang.annotation.*;

/**
 * Declares that a controller endpoint or service method requires a specific dynamic feature entitlement.
 * Intercepted by {@link FeatureEntitlementAspect}.
 */
@Target({ElementType.METHOD, ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface RequireFeature {
    /**
     * The dynamic feature key string (e.g. FEATURE_PATTERN_C_GRAPH, FEATURE_SCHEMA_STUDIO, FEATURE_AI_AGENT_MCP).
     */
    String value();
}
