package com.acc.core.constant;

/**
 * Standard Canonical Roles across Sovereign and Tenant domains.
 */
public final class CanonicalRoles {

    private CanonicalRoles() {}

    // Sovereign Roles (System Fleet & Custody)
    public static final String ROLE_SYSTEM_ROOT = "ROLE_SYSTEM_ROOT";
    public static final String ROLE_SYSTEM_SUPPORT = "ROLE_SYSTEM_SUPPORT";

    // Inside-Tenant Roles
    public static final String ROLE_WORKSPACE_OWNER = "ROLE_WORKSPACE_OWNER";
    public static final String ROLE_OPERATIONS_MANAGER = "ROLE_OPERATIONS_MANAGER";
    public static final String ROLE_STANDARD_MEMBER = "ROLE_STANDARD_MEMBER";
    public static final String ROLE_AUDITOR = "ROLE_AUDITOR";
}
