package com.acc.core.constant;

/**
 * System-Wide Canonical Permission Atom Catalog.
 * Format strictly conforms to: <plane>:<resource>:<action>
 */
public final class CanonicalPermissions {

    private CanonicalPermissions() {}

    // ==========================================
    // 1. Platform Plane (Sovereign Operations)
    // ==========================================
    public static final String PLATFORM_FLEET_READ = "platform:fleet:read";
    public static final String PLATFORM_FLEET_MUTATE = "platform:fleet:mutate";
    public static final String PLATFORM_FLEET_TRIP_CIRCUIT = "platform:fleet:trip_circuit";
    public static final String PLATFORM_TENANT_ASSUME = "platform:tenant:assume";
    public static final String PLATFORM_TENANT_PURGE = "platform:tenant:purge";
    public static final String PLATFORM_QUOTAS_MANAGE = "platform:quotas:manage";
    public static final String PLATFORM_ROLES_MANAGE = "platform:roles:manage";
    public static final String PLATFORM_USERS_MANAGE = "platform:users:manage";
    public static final String PLATFORM_DLQ_MANAGE = "platform:dlq:manage";
    public static final String PLATFORM_WORKERS_MANAGE = "platform:workers:manage";

    // ==========================================
    // 2. Metadata Plane (Dynamic Schema & Blueprints)
    // ==========================================
    public static final String METADATA_SCHEMA_READ = "metadata:schema:read";
    public static final String METADATA_SCHEMA_WRITE = "metadata:schema:write";
    public static final String METADATA_BLUEPRINT_PACKAGE = "metadata:blueprint:package";
    public static final String METADATA_BLUEPRINT_PROVISION = "metadata:blueprint:provision";
    public static final String METADATA_CACHE_EVICT = "metadata:cache:evict";

    // ==========================================
    // 3. Entity Records Plane (Dynamic Data CRUD)
    // ==========================================
    public static final String ENTITY_RECORD_READ = "entity:record:read";
    public static final String ENTITY_RECORD_CREATE = "entity:record:create";
    public static final String ENTITY_RECORD_UPDATE = "entity:record:update";
    public static final String ENTITY_RECORD_DELETE = "entity:record:delete";
    public static final String ENTITY_RECORD_EXPORT = "entity:record:export";

    // ==========================================
    // 4. Workspace Plane (Inside-Tenant Admin)
    // ==========================================
    public static final String WORKSPACE_SETTINGS_READ = "workspace:settings:read";
    public static final String WORKSPACE_SETTINGS_MANAGE = "workspace:settings:manage";
    public static final String WORKSPACE_MEMBERS_READ = "workspace:members:read";
    public static final String WORKSPACE_MEMBERS_MANAGE = "workspace:members:manage";

    // ==========================================
    // 5. Workflow Plane (Orchestration & Approvals)
    // ==========================================
    public static final String WORKFLOW_DEFINITION_READ = "workflow:definition:read";
    public static final String WORKFLOW_DEFINITION_MANAGE = "workflow:definition:manage";
    public static final String WORKFLOW_EXECUTION_READ = "workflow:execution:read";
    public static final String WORKFLOW_EXECUTION_SUBMIT = "workflow:execution:submit";
    public static final String WORKFLOW_APPROVAL_EXECUTE = "workflow:approval:execute";

    // ==========================================
    // 6. Audit Plane (Compliance & Proof)
    // ==========================================
    public static final String AUDIT_LOG_READ = "audit:log:read";
    public static final String AUDIT_HASH_VERIFY = "audit:hash:verify";
    public static final String AUDIT_COMPLIANCE_EXPORT = "audit:compliance:export";

    // ==========================================
    // 7. Commercial Billing Plane (Subscriptions & Invoices)
    // ==========================================
    public static final String BILLING_SUBSCRIPTION_READ = "billing:subscription:read";
    public static final String BILLING_SUBSCRIPTION_UPGRADE = "billing:subscription:upgrade";
    public static final String BILLING_TIER_OVERRIDE = "billing:tier:override";
    public static final String BILLING_INVOICE_ADJUST = "billing:invoice:adjust";
}
