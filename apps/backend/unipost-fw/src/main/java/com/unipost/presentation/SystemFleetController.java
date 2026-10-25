package com.unipost.presentation;

import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.system.dto.*;
import com.unipost.system.service.SystemFleetService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

/**
 * Sovereign Custodian Fleet REST Controller.
 * Protected by strict authorization: only callers with Sovereign Custodian authority
 * or ADMIN role can invoke fleet management, quota tuning, or impersonation endpoints.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/system")
@RequiredArgsConstructor
public class SystemFleetController {

    private final SystemFleetService fleetService;
    private final ResponseEntityBuilder responseBuilder;

    /**
     * Paginated fleet listing with search, tier, status filters.
     */
    @GetMapping("/tenants")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'platform:fleet:read') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Page<FleetTenantSummaryDto>>> listTenants(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String tier,
            @RequestParam(required = false) String status,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<FleetTenantSummaryDto> page = fleetService.listFleetTenants(search, tier, status, pageable);
        return responseBuilder.success(page);
    }

    /**
     * Provisions a new organization under sovereign custody with blueprint seeding.
     */
    @PostMapping("/tenants")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'platform:fleet:mutate') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> createTenant(
            @Valid @RequestBody CreateTenantRequest request) {
        FleetTenantSummaryDto created = fleetService.createTenant(request);
        return responseBuilder.success(created);
    }

    /**
     * Detailed fleet diagnostics for a specific tenant (telemetry, storage, quota dials).
     */
    @GetMapping("/tenants/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'platform:fleet:read') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> getTenantDiagnostics(
            @PathVariable("id") String tenantId) {
        FleetTenantSummaryDto diagnostics = fleetService.getFleetTenantDiagnostics(tenantId);
        return responseBuilder.success(diagnostics);
    }

    /**
     * Soft kill-switch toggle (ACTIVE <-> SUSPENDED <-> ARCHIVED).
     */
    @PutMapping("/tenants/{id}/status")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'platform:fleet:mutate') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> updateTenantStatus(
            @PathVariable("id") String tenantId,
            @Valid @RequestBody UpdateTenantStatusRequest request) {
        FleetTenantSummaryDto updated = fleetService.updateTenantStatus(tenantId, request);
        return responseBuilder.success(updated);
    }

    /**
     * Manual commercial tier promotion/downscale with feature flag cherry-picking.
     */
    @PutMapping("/tenants/{id}/subscription")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'platform:fleet:mutate') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> overrideSubscription(
            @PathVariable("id") String tenantId,
            @Valid @RequestBody OverrideSubscriptionRequest request) {
        FleetTenantSummaryDto updated = fleetService.overrideSubscription(tenantId, request);
        return responseBuilder.success(updated);
    }

    /**
     * Sovereign data volume & workspace quota override injection.
     */
    @PutMapping("/tenants/{id}/quotas")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'platform:quotas:override') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> updateTenantQuotas(
            @PathVariable("id") String tenantId,
            @Valid @RequestBody UpdateTenantQuotasRequest request) {
        FleetTenantSummaryDto updated = fleetService.updateTenantQuotas(tenantId, request);
        return responseBuilder.success(updated);
    }

    /**
     * Generates ephemeral Assume-Tenant delegated session token for instant impersonation.
     */
    @PostMapping("/tenants/{id}/assume")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'platform:tenant:assume') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, AssumeTenantTokenResponse>> assumeTenant(
            @PathVariable("id") String tenantId,
            @Valid @RequestBody AssumeTenantRequest request) {
        AssumeTenantTokenResponse tokenResponse = fleetService.assumeTenant(tenantId, request);
        return responseBuilder.success(tokenResponse);
    }

    /**
     * List RBAC roles with mapped permission atoms and user counts.
     */
    @GetMapping("/roles")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'platform:roles:manage') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, List<RoleWithPermissionsDto>>> listRoles() {
        List<RoleWithPermissionsDto> roles = fleetService.listRoles();
        return responseBuilder.success(roles);
    }

    /**
     * Provisions a new custom RBAC role with DAG inheritance.
     */
    @PostMapping("/roles")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'platform:roles:manage') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, RoleWithPermissionsDto>> createRole(
            @Valid @RequestBody CreateRoleRequest request) {
        RoleWithPermissionsDto created = fleetService.createRole(request);
        return responseBuilder.success(created);
    }

    /**
     * Update role permission bindings in RBAC matrix studio.
     */
    @PutMapping("/roles/{id}/permissions")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'platform:roles:manage') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, RoleWithPermissionsDto>> updateRolePermissions(
            @PathVariable("id") String roleId,
            @Valid @RequestBody UpdateRolePermissionsRequest request) {
        RoleWithPermissionsDto updated = fleetService.updateRolePermissions(roleId, request);
        return responseBuilder.success(updated);
    }

    /**
     * Universal cross-tenant user lookup.
     */
    @GetMapping("/users")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'ROLE_SYSTEM_SUPPORT', 'platform:fleet:read') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, Page<GlobalUserListItemDto>>> listGlobalUsers(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String tenantId,
            @PageableDefault(size = 20) Pageable pageable) {
        Page<GlobalUserListItemDto> users = fleetService.listGlobalUsers(search, tenantId, pageable);
        return responseBuilder.success(users);
    }

    /**
     * Emergency credential lockdown (lock/unlock user).
     */
    @PutMapping("/users/{id}/lock")
    @PreAuthorize("hasAnyAuthority('ROLE_SYSTEM_ROOT', 'platform:users:lock') or hasRole('ADMIN')")
    public ResponseEntity<ResponseWrapper<ContextHeader, GlobalUserListItemDto>> lockUser(
            @PathVariable("id") String userId,
            @Valid @RequestBody LockUserRequest request) {
        GlobalUserListItemDto updated = fleetService.lockUser(userId, request);
        return responseBuilder.success(updated);
    }
}
