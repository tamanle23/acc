package com.acc.tenant.purge;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Stage 1 ingress lockdown: tracks tenants in PURGING state so mutations are rejected (HTTP 423)
 * while the hard-purge is in flight.
 */
@Component
public class TenantPurgeLockRegistry {

    private final Set<String> purging = ConcurrentHashMap.newKeySet();

    /** @return true if this call acquired the lock (false if a purge is already running). */
    public boolean lock(String tenantId) {
        return purging.add(normalize(tenantId));
    }

    public void unlock(String tenantId) {
        purging.remove(normalize(tenantId));
    }

    public boolean isPurging(String tenantId) {
        return tenantId != null && purging.contains(normalize(tenantId));
    }

    private static String normalize(String tenantId) {
        return tenantId.trim().toLowerCase(Locale.ROOT);
    }
}
