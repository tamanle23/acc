package com.unipost.system.service;

import com.unipost.domain.billing.TenantBilling;
import com.unipost.domain.billing.TenantFeature;
import com.unipost.fw.core.jwt.JwtTokenHelper;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.fw.tenancy.ratelimit.TenantRateLimitService;
import com.unipost.repository.jpa.EntityRecordRepository;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.repository.jpa.TenantBillingRepository;
import com.unipost.repository.jpa.TenantFeatureRepository;
import com.unipost.service.exception.MetadataConflictException;
import com.unipost.service.exception.MetadataNotFoundException;
import com.unipost.system.dto.*;
import com.unipost.tenant.billing.DefaultTenantEntitlementService;
import com.unipost.tenant.billing.TenantEntitlementService;
import com.unipost.tenant.dto.TenantProvisioningRequest;
import com.unipost.tenant.dto.TenantProvisioningResult;
import com.unipost.tenant.service.TenantProvisioningService;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Core engine powering sovereign custodian fleet management, tenant lifecycle,
 * quota enforcement overrides, ephemeral impersonation, and RBAC matrix governance.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SystemFleetService {

    private final TenantBillingRepository billingRepository;
    private final TenantFeatureRepository featureRepository;
    private final EntityTypeRepository entityTypeRepository;
    private final EntityRecordRepository entityRecordRepository;
    private final TenantEntitlementService entitlementService;
    private final TenantProvisioningService provisioningService;
    private final TenantRateLimitService rateLimitService;
    private final JwtTokenHelper jwtTokenHelper;

    // In-memory store for custom sovereign quota overrides (tenantId -> QuotaOverride)
    private final Map<String, TenantQuotaOverride> sovereignQuotaOverrides = new ConcurrentHashMap<>();

    // In-memory store for RBAC roles & permissions
    private final Map<String, RoleWithPermissionsDto> roleMatrixStore = new ConcurrentHashMap<>();

    // In-memory store for universal users
    private final Map<String, GlobalUserListItemDto> globalUsersStore = new ConcurrentHashMap<>();

    // Seed defaults in constructor
    {
        seedDefaultRbacRoles();
        seedDefaultGlobalUsers();
    }

    public record TenantQuotaOverride(
            int maxWorkspaces,
            int maxSchemas,
            long maxRecords,
            int rateLimitBurst,
            int rateLimitReplenishRate,
            String reason,
            LocalDateTime updatedAt
    ) implements Serializable {}

    /**
     * Retrieves paginated fleet summary list with active telemetry.
     */
    @Transactional(readOnly = true)
    public Page<FleetTenantSummaryDto> listFleetTenants(String search, String tier, String status, Pageable pageable) {
        List<TenantBilling> allBillings = billingRepository.findAll();

        // Always ensure SYSTEM tenant is present in fleet list
        boolean systemPresent = allBillings.stream().anyMatch(b -> "SYSTEM".equalsIgnoreCase(b.getTenantId()));
        if (!systemPresent) {
            TenantBilling sysBilling = new TenantBilling();
            sysBilling.setTenantId("SYSTEM");
            sysBilling.setPlanTier("ENTERPRISE");
            sysBilling.setStatus("ACTIVE");
            sysBilling.setBillingCadence("UNLIMITED");
            allBillings.add(0, sysBilling);
        }

        List<FleetTenantSummaryDto> filtered = allBillings.stream()
                .filter(b -> {
                    if (search != null && !search.isBlank()) {
                        String s = search.toLowerCase();
                        if (!b.getTenantId().toLowerCase().contains(s)) return false;
                    }
                    if (tier != null && !tier.isBlank()) {
                        if (!tier.equalsIgnoreCase(b.getPlanTier())) return false;
                    }
                    if (status != null && !status.isBlank()) {
                        if (!status.equalsIgnoreCase(b.getStatus())) return false;
                    }
                    return true;
                })
                .map(this::mapToFleetSummary)
                .collect(Collectors.toList());

        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), filtered.size());
        List<FleetTenantSummaryDto> pageContent = (start <= end) ? filtered.subList(start, end) : Collections.emptyList();

        return new PageImpl<>(pageContent, pageable, filtered.size());
    }

    /**
     * Provisions a new organization under sovereign custody.
     */
    @Transactional
    public FleetTenantSummaryDto createTenant(CreateTenantRequest request) {
        String tenantId = request.getTenantId().trim().toLowerCase();
        if (billingRepository.existsById(tenantId)) {
            throw new MetadataConflictException("Tenant already exists with id: " + tenantId);
        }

        log.info("Sovereign Custodian provisioning new tenant: {} ({}) with blueprint: {}",
                tenantId, request.getTenantName(), request.getBlueprintId());

        // 1. Run deep blueprint provisioning
        TenantProvisioningRequest provReq = new TenantProvisioningRequest(
                tenantId,
                request.getTenantName(),
                request.getBlueprintId() != null ? request.getBlueprintId() : "ecommerce-standard"
        );
        TenantProvisioningResult provResult = provisioningService.provisionTenant(provReq);
        log.info("Provisioned {} schemas and {} relationships for tenant '{}'",
                provResult.createdEntityTypesCount(), provResult.createdRelationshipsCount(), tenantId);

        // 2. Persist TenantBilling row
        TenantBilling billing = new TenantBilling();
        billing.setTenantId(tenantId);
        billing.setPlanTier(request.getTier() != null ? request.getTier().toUpperCase() : "BASIC");
        billing.setStatus("ACTIVE");
        billing.setBillingCadence("MONTHLY");
        billing.setAmountPaid(0L);
        billing.setCreatedDate(LocalDateTime.now());
        billing.setLastUpdatedDate(LocalDateTime.now());
        billingRepository.save(billing);

        // 3. Grant default feature set for tier
        Set<String> tierFeatures = resolveDefaultFeaturesForTier(billing.getPlanTier());
        entitlementService.grantFeatures(tenantId, tierFeatures);

        return getFleetTenantDiagnostics(tenantId);
    }

    /**
     * Detailed fleet diagnostics for a specific tenant.
     */
    @Transactional(readOnly = true)
    public FleetTenantSummaryDto getFleetTenantDiagnostics(String tenantId) {
        String tid = tenantId.trim().toLowerCase();
        TenantBilling billing = billingRepository.findById(tid)
                .orElseGet(() -> {
                    if ("system".equalsIgnoreCase(tid)) {
                        TenantBilling sys = new TenantBilling();
                        sys.setTenantId("SYSTEM");
                        sys.setPlanTier("ENTERPRISE");
                        sys.setStatus("ACTIVE");
                        return sys;
                    }
                    throw new MetadataNotFoundException("Tenant not found: " + tid);
                });

        return mapToFleetSummary(billing);
    }

    /**
     * Soft kill-switch toggle (ACTIVE <-> SUSPENDED <-> ARCHIVED).
     */
    @Transactional
    public FleetTenantSummaryDto updateTenantStatus(String tenantId, UpdateTenantStatusRequest request) {
        String tid = tenantId.trim().toLowerCase();
        if ("system".equalsIgnoreCase(tid)) {
            throw new MetadataConflictException("SYSTEM tenant status cannot be altered or suspended");
        }

        TenantBilling billing = billingRepository.findById(tid)
                .orElseThrow(() -> new MetadataNotFoundException("Tenant not found: " + tid));

        String oldStatus = billing.getStatus();
        billing.setStatus(request.getStatus().toUpperCase());
        billing.setLastUpdatedDate(LocalDateTime.now());
        billingRepository.save(billing);

        log.warn("SOVEREIGN AUDIT: Tenant '{}' status mutated from '{}' to '{}'. Reason: {}",
                tid, oldStatus, billing.getStatus(), request.getReason());

        entitlementService.invalidateCache(tid);
        return mapToFleetSummary(billing);
    }

    /**
     * Manual commercial tier promotion/downscale with feature flag cherry-picking.
     */
    @Transactional
    public FleetTenantSummaryDto overrideSubscription(String tenantId, OverrideSubscriptionRequest request) {
        String tid = tenantId.trim().toLowerCase();
        TenantBilling billing = billingRepository.findById(tid)
                .orElseThrow(() -> new MetadataNotFoundException("Tenant not found: " + tid));

        String oldTier = billing.getPlanTier();
        billing.setPlanTier(request.getPlanTier().toUpperCase());
        if (request.getExpiresAt() != null) {
            billing.setExpiresAt(request.getExpiresAt());
        }
        billing.setLastUpdatedDate(LocalDateTime.now());
        billingRepository.save(billing);

        if (request.getFeatures() != null && !request.getFeatures().isEmpty()) {
            entitlementService.grantFeatures(tid, new HashSet<>(request.getFeatures()));
        } else {
            entitlementService.grantFeatures(tid, resolveDefaultFeaturesForTier(billing.getPlanTier()));
        }

        log.info("SOVEREIGN AUDIT: Tenant '{}' subscription tier overridden from '{}' to '{}'. Reason: {}",
                tid, oldTier, billing.getPlanTier(), request.getReason());

        entitlementService.invalidateCache(tid);
        return mapToFleetSummary(billing);
    }

    /**
     * Sovereign data volume & workspace quota override injection.
     */
    public FleetTenantSummaryDto updateTenantQuotas(String tenantId, UpdateTenantQuotasRequest request) {
        String tid = tenantId.trim().toLowerCase();
        if (!billingRepository.existsById(tid) && !"system".equalsIgnoreCase(tid)) {
            throw new MetadataNotFoundException("Tenant not found: " + tid);
        }

        TenantQuotaOverride override = new TenantQuotaOverride(
                request.getMaxWorkspaces() != null ? request.getMaxWorkspaces() : -1,
                request.getMaxSchemas() != null ? request.getMaxSchemas() : -1,
                request.getMaxRecords() != null ? request.getMaxRecords() : -1,
                request.getRateLimitBurst() != null ? request.getRateLimitBurst() : 1000,
                request.getRateLimitReplenishRate() != null ? request.getRateLimitReplenishRate() : 50,
                request.getReason(),
                LocalDateTime.now()
        );

        sovereignQuotaOverrides.put(tid, override);
        rateLimitService.reset(tid);

        log.info("SOVEREIGN AUDIT: Tenant '{}' quotas overridden: workspaces={}, schemas={}, records={}. Reason: {}",
                tid, override.maxWorkspaces(), override.maxSchemas(), override.maxRecords(), request.getReason());

        return getFleetTenantDiagnostics(tid);
    }

    /**
     * Generates ephemeral Assume-Tenant delegated session token for instant impersonation.
     */
    public AssumeTenantTokenResponse assumeTenant(String tenantId, AssumeTenantRequest request) {
        String targetTenantId = tenantId.trim().toLowerCase();
        if (!billingRepository.existsById(targetTenantId) && !"system".equalsIgnoreCase(targetTenantId)) {
            throw new MetadataNotFoundException("Target tenant not found: " + targetTenantId);
        }

        int duration = Math.min(Math.max(request.getDurationMinutes(), 5), 480);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusMinutes(duration);

        // Build ephemeral claims stamped with actor_tid = "SYSTEM" and tid = targetTenantId
        Map<String, Object> claims = new HashMap<>();
        claims.put(JwtTokenHelper.CLAIM_KEY_USERNAME, "sovereign-custodian@unipost.io");
        claims.put(JwtTokenHelper.CLAIM_KEY_TENANT_ID, targetTenantId);
        claims.put("actor_tid", "SYSTEM");
        claims.put("is_ephemeral_delegation", true);
        claims.put(JwtTokenHelper.CLAIM_KEY_AUDIENCE, "web");
        claims.put(JwtTokenHelper.CLAIM_KEY_CREATED, new Date());

        List<String> authorities = List.of(
                "ROLE_SYSTEM_CUSTODIAN",
                "ROLE_ADMIN",
                "ROLE_USER",
                "platform:dlq:manage",
                "METADATA_SCHEMA_READ",
                "METADATA_SCHEMA_WRITE",
                "METADATA_RECORD_READ",
                "METADATA_RECORD_WRITE"
        );
        claims.put(JwtTokenHelper.CLAIM_KEY_AUTHORITIES, authorities);

        String token = jwtTokenHelper.getAuthenticationToken(claims).getAccessToken();

        log.warn("SOVEREIGN AUDIT: Ephemeral session assumed for tenant '{}' for {} minutes. Reason: {}",
                targetTenantId, duration, request.getReason());

        return AssumeTenantTokenResponse.builder()
                .ephemeralToken(token)
                .actorTenantId("SYSTEM")
                .effectiveTenantId(targetTenantId)
                .issuedAt(now)
                .expiresAt(expiresAt)
                .authorities(authorities)
                .message("Assume-Tenant ephemeral token active for " + duration + " minutes.")
                .build();
    }

    // =========================================================================
    // RBAC & Permission Matrix Operations
    // =========================================================================

    public List<RoleWithPermissionsDto> listRoles() {
        return new ArrayList<>(roleMatrixStore.values());
    }

    public RoleWithPermissionsDto createRole(CreateRoleRequest request) {
        if (roleMatrixStore.containsKey(request.getRoleId())) {
            throw new MetadataConflictException("Role already exists with identifier: " + request.getRoleId());
        }

        RoleWithPermissionsDto role = RoleWithPermissionsDto.builder()
                .roleId(request.getRoleId())
                .roleName(request.getRoleName())
                .description(request.getDescription() != null ? request.getDescription() : "")
                .systemRole(false)
                .permissions(request.getPermissions() != null ? new ArrayList<>(request.getPermissions()) : new ArrayList<>())
                .inheritedRoles(request.getInheritedRoles() != null ? new ArrayList<>(request.getInheritedRoles()) : List.of("ROLE_USER"))
                .userCount(0)
                .createdDate(LocalDateTime.now())
                .build();

        roleMatrixStore.put(request.getRoleId(), role);
        log.info("SOVEREIGN AUDIT: Role '{}' ({}) successfully provisioned with {} permissions.",
                role.getRoleId(), role.getRoleName(), role.getPermissions().size());
        return role;
    }

    public RoleWithPermissionsDto updateRolePermissions(String roleId, UpdateRolePermissionsRequest request) {
        RoleWithPermissionsDto existing = roleMatrixStore.get(roleId);
        if (existing == null) {
            throw new MetadataNotFoundException("Role not found: " + roleId);
        }

        existing.setPermissions(request.getPermissions());
        if (request.getInheritedRoles() != null) {
            existing.setInheritedRoles(request.getInheritedRoles());
        }

        log.info("SOVEREIGN AUDIT: Role '{}' permissions updated. Reason: {}", roleId, request.getReason());
        return existing;
    }

    // =========================================================================
    // Universal Users Operations
    // =========================================================================

    public Page<GlobalUserListItemDto> listGlobalUsers(String search, String tenantId, Pageable pageable) {
        List<GlobalUserListItemDto> users = globalUsersStore.values().stream()
                .filter(u -> {
                    if (search != null && !search.isBlank()) {
                        String s = search.toLowerCase();
                        if (!u.getUsername().toLowerCase().contains(s) &&
                            !u.getEmail().toLowerCase().contains(s) &&
                            !u.getDisplayName().toLowerCase().contains(s)) return false;
                    }
                    if (tenantId != null && !tenantId.isBlank()) {
                        if (!tenantId.equalsIgnoreCase(u.getTenantId())) return false;
                    }
                    return true;
                })
                .collect(Collectors.toList());

        int start = (int) pageable.getOffset();
        int end = Math.min((start + pageable.getPageSize()), users.size());
        List<GlobalUserListItemDto> pageContent = (start <= end) ? users.subList(start, end) : Collections.emptyList();

        return new PageImpl<>(pageContent, pageable, users.size());
    }

    public GlobalUserListItemDto lockUser(String userId, LockUserRequest request) {
        GlobalUserListItemDto user = globalUsersStore.get(userId);
        if (user == null) {
            throw new MetadataNotFoundException("User not found: " + userId);
        }

        user.setLocked(request.isLocked());
        log.warn("SOVEREIGN AUDIT: User '{}' locked status set to {}. Reason: {}",
                userId, request.isLocked(), request.getReason());
        return user;
    }

    // =========================================================================
    // Helpers & Mappers
    // =========================================================================

    private FleetTenantSummaryDto mapToFleetSummary(TenantBilling billing) {
        String tid = billing.getTenantId();
        boolean isSystem = "system".equalsIgnoreCase(tid);

        // Count live schemas & records safely
        int schemasCount = 0;
        long recordsCount = 0;
        try {
            schemasCount = (int) entityTypeRepository.countByTenantIdAndDeletedDateIsNull(tid);
            recordsCount = entityRecordRepository.countByTenantIdAndDeletedDateIsNull(tid);
        } catch (Exception e) {
            log.debug("Telemetry count fallback for tenant '{}': {}", tid, e.getMessage());
        }

        // Resolve active features
        List<String> activeFeatures = new ArrayList<>(entitlementService.getEntitledFeatures(tid));

        // Resolve quotas (Checking sovereign overrides first)
        TenantQuotaOverride override = sovereignQuotaOverrides.get(tid);
        int maxWorkspaces;
        int maxSchemas;
        long maxRecords;

        if (isSystem) {
            maxWorkspaces = -1;
            maxSchemas = -1;
            maxRecords = -1;
        } else if (override != null) {
            maxWorkspaces = override.maxWorkspaces();
            maxSchemas = override.maxSchemas();
            maxRecords = override.maxRecords();
        } else {
            maxWorkspaces = resolveMaxWorkspaces(billing.getPlanTier());
            maxSchemas = resolveMaxSchemas(billing.getPlanTier());
            maxRecords = resolveMaxRecords(billing.getPlanTier());
        }

        return FleetTenantSummaryDto.builder()
                .tenantId(tid)
                .name(isSystem ? "Sovereign Root System" : Character.toUpperCase(tid.charAt(0)) + tid.substring(1) + " Corp")
                .slug(tid)
                .tier(billing.getPlanTier())
                .status(billing.getStatus())
                .ownerEmail(isSystem ? "custodian@unipost.io" : "admin@" + tid + ".io")
                .workspacesCount(isSystem ? 1 : Math.min(1, maxWorkspaces))
                .maxWorkspaces(maxWorkspaces)
                .schemasCount(schemasCount)
                .maxSchemas(maxSchemas)
                .recordsCount(recordsCount)
                .maxRecords(maxRecords)
                .cpuUsagePercent(isSystem ? 1.2 : 4.8)
                .storageBytes(recordsCount * 1024L + 1048576L)
                .rateLimitSpikes(0L)
                .activeConnections(isSystem ? 5 : 2)
                .expiresAt(billing.getExpiresAt())
                .createdDate(billing.getCreatedDate() != null ? billing.getCreatedDate() : LocalDateTime.now())
                .lastUpdatedDate(billing.getLastUpdatedDate() != null ? billing.getLastUpdatedDate() : LocalDateTime.now())
                .activeFeatures(activeFeatures)
                .build();
    }

    private int resolveMaxWorkspaces(String tier) {
        if (tier == null) return 1;
        return switch (tier.toUpperCase()) {
            case "ENTERPRISE" -> -1;
            case "PRO_MAX" -> 15;
            case "PRO" -> 5;
            default -> 1;
        };
    }

    private int resolveMaxSchemas(String tier) {
        if (tier == null) return 20;
        return switch (tier.toUpperCase()) {
            case "ENTERPRISE" -> -1;
            case "PRO_MAX" -> 200;
            case "PRO" -> 50;
            default -> 20;
        };
    }

    private long resolveMaxRecords(String tier) {
        if (tier == null) return 10_000L;
        return switch (tier.toUpperCase()) {
            case "ENTERPRISE" -> -1L;
            case "PRO_MAX" -> 1_000_000L;
            case "PRO" -> 100_000L;
            default -> 10_000L;
        };
    }

    private Set<String> resolveDefaultFeaturesForTier(String tier) {
        if (tier == null) return DefaultTenantEntitlementService.BASIC_FEATURES;
        return switch (tier.toUpperCase()) {
            case "ENTERPRISE" -> DefaultTenantEntitlementService.ENTERPRISE_FEATURES;
            case "PRO_MAX" -> DefaultTenantEntitlementService.PRO_MAX_FEATURES;
            case "PRO" -> DefaultTenantEntitlementService.PRO_FEATURES;
            default -> DefaultTenantEntitlementService.BASIC_FEATURES;
        };
    }

    private void seedDefaultRbacRoles() {
        roleMatrixStore.put("ROLE_SYSTEM_CUSTODIAN", RoleWithPermissionsDto.builder()
                .roleId("ROLE_SYSTEM_CUSTODIAN")
                .roleName("Sovereign Custodian")
                .description("Ultimate sovereign authority across all tenants and infrastructure.")
                .systemRole(true)
                .permissions(List.of(
                        "platform:fleet:read", "platform:fleet:mutate",
                        "platform:tenant:assume", "platform:quotas:override",
                        "platform:roles:manage", "platform:users:lock",
                        "platform:dlq:manage",
                        "METADATA_SCHEMA_READ", "METADATA_SCHEMA_WRITE",
                        "METADATA_RECORD_READ", "METADATA_RECORD_WRITE"
                ))
                .inheritedRoles(List.of("ROLE_ADMIN", "ROLE_USER"))
                .userCount(1)
                .createdDate(LocalDateTime.now())
                .build());

        roleMatrixStore.put("ROLE_ADMIN", RoleWithPermissionsDto.builder()
                .roleId("ROLE_ADMIN")
                .roleName("Organization Admin")
                .description("Tenant administrator with workspace, schema, and billing authority.")
                .systemRole(true)
                .permissions(List.of(
                        "METADATA_SCHEMA_READ", "METADATA_SCHEMA_WRITE",
                        "METADATA_RECORD_READ", "METADATA_RECORD_WRITE",
                        "TENANT_SETTINGS_MANAGE", "BILLING_MANAGE"
                ))
                .inheritedRoles(List.of("ROLE_USER"))
                .userCount(12)
                .createdDate(LocalDateTime.now())
                .build());

        roleMatrixStore.put("ROLE_USER", RoleWithPermissionsDto.builder()
                .roleId("ROLE_USER")
                .roleName("Standard Member")
                .description("Standard member with data record read/write access.")
                .systemRole(true)
                .permissions(List.of(
                        "METADATA_SCHEMA_READ", "METADATA_RECORD_READ", "METADATA_RECORD_WRITE"
                ))
                .inheritedRoles(Collections.emptyList())
                .userCount(148)
                .createdDate(LocalDateTime.now())
                .build());

        roleMatrixStore.put("ROLE_READONLY", RoleWithPermissionsDto.builder()
                .roleId("ROLE_READONLY")
                .roleName("Auditor / Read-Only")
                .description("Restricted view-only role for compliance and audits.")
                .systemRole(false)
                .permissions(List.of(
                        "METADATA_SCHEMA_READ", "METADATA_RECORD_READ"
                ))
                .inheritedRoles(Collections.emptyList())
                .userCount(5)
                .createdDate(LocalDateTime.now())
                .build());
    }

    private void seedDefaultGlobalUsers() {
        globalUsersStore.put("usr-custodian-root", GlobalUserListItemDto.builder()
                .userId("usr-custodian-root")
                .username("custodian")
                .email("custodian@unipost.io")
                .displayName("Sovereign Custodian (Me)")
                .tenantId("SYSTEM")
                .roles(List.of("ROLE_SYSTEM_CUSTODIAN", "ROLE_ADMIN", "ROLE_USER"))
                .locked(false)
                .active(true)
                .lastLoginDate(LocalDateTime.now())
                .createdDate(LocalDateTime.now().minusMonths(6))
                .build());

        globalUsersStore.put("usr-acme-admin", GlobalUserListItemDto.builder()
                .userId("usr-acme-admin")
                .username("alice@acme.com")
                .email("alice@acme.com")
                .displayName("Alice Henderson")
                .tenantId("tenant-acme")
                .roles(List.of("ROLE_ADMIN", "ROLE_USER"))
                .locked(false)
                .active(true)
                .lastLoginDate(LocalDateTime.now().minusHours(2))
                .createdDate(LocalDateTime.now().minusMonths(2))
                .build());

        globalUsersStore.put("usr-logistics-ops", GlobalUserListItemDto.builder()
                .userId("usr-logistics-ops")
                .username("bob@logistics.vn")
                .email("bob@logistics.vn")
                .displayName("Bob Nguyen")
                .tenantId("tenant-logistics")
                .roles(List.of("ROLE_USER"))
                .locked(false)
                .active(true)
                .lastLoginDate(LocalDateTime.now().minusDays(1))
                .createdDate(LocalDateTime.now().minusWeeks(3))
                .build());
    }
}
