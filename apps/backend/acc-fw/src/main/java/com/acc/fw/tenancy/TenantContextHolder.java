package com.acc.fw.tenancy;

import java.util.Objects;

/**
 * ThreadLocal context holder for active tenant identifier.
 */
public final class TenantContextHolder {

    private static final ThreadLocal<String> CURRENT_TENANT = new ThreadLocal<>();
    private static final ThreadLocal<String> ACTOR_TENANT = new ThreadLocal<>();

    private TenantContextHolder() {
        // Prevent instantiation
    }

    /**
     * Set the current tenant ID in the ThreadLocal context (both effective and actor default to this ID).
     *
     * @param tenantId the tenant ID
     */
    public static void setTenantId(String tenantId) {
        CURRENT_TENANT.set(tenantId);
        ACTOR_TENANT.set(tenantId);
    }

    /**
     * Set explicit dual-context identification for Assume-Tenant impersonated sessions.
     *
     * @param effectiveTenantId the target tenant scope being inspected
     * @param actorTenantId     the authenticated sovereign caller executing the request
     */
    public static void setDualContext(String effectiveTenantId, String actorTenantId) {
        CURRENT_TENANT.set(effectiveTenantId);
        ACTOR_TENANT.set(actorTenantId != null ? actorTenantId : effectiveTenantId);
    }

    /**
     * Get the current effective tenant ID from the ThreadLocal context.
     *
     * @return the active tenant ID, or null if not set
     */
    public static String getTenantId() {
        return CURRENT_TENANT.get();
    }

    /**
     * Get the sovereign actor tenant ID who initiated this execution context.
     *
     * @return the actor tenant ID, or null if not set
     */
    public static String getActorTenantId() {
        return ACTOR_TENANT.get() != null ? ACTOR_TENANT.get() : CURRENT_TENANT.get();
    }

    /**
     * Checks if current execution is running under an impersonated Assume-Tenant session.
     */
    public static boolean isImpersonating() {
        String effective = CURRENT_TENANT.get();
        String actor = ACTOR_TENANT.get();
        return effective != null && actor != null && !Objects.equals(effective, actor);
    }

    /**
     * Checks if the active actor holds sovereign custody authority (actor is 'SYSTEM').
     */
    public static boolean isSovereignActor() {
        return "SYSTEM".equalsIgnoreCase(getActorTenantId());
    }

    /**
     * Get the required tenant ID from the ThreadLocal context.
     *
     * @return the active tenant ID
     * @throws IllegalStateException if no tenant ID is present on current thread
     */
    public static String getRequiredTenantId() {
        String tenantId = CURRENT_TENANT.get();
        if (tenantId == null || tenantId.isBlank()) {
            throw new IllegalStateException("Security violation: No active TenantContext found on current thread");
        }
        return tenantId;
    }

    /**
     * Clear the current tenant context.
     */
    public static void clear() {
        CURRENT_TENANT.remove();
        ACTOR_TENANT.remove();
    }
}
