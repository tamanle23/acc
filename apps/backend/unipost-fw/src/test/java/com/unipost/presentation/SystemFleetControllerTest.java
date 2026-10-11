package com.unipost.presentation;

import com.unipost.core.context.Context;
import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.ResponseEntityBuilder;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.system.dto.*;
import com.unipost.system.service.SystemFleetService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SystemFleetControllerTest {

    @Mock
    private SystemFleetService fleetService;

    @Mock
    private Context contextHelper;

    private ResponseEntityBuilder responseBuilder;
    private SystemFleetController controller;

    private static final String SYSTEM_TENANT = "SYSTEM";
    private static final String TARGET_TENANT = "tenant-acme";

    @BeforeEach
    void setUp() {
        responseBuilder = new ResponseEntityBuilder();
        ReflectionTestUtils.setField(responseBuilder, "contextHelper", contextHelper);
        controller = new SystemFleetController(fleetService, responseBuilder);

        TenantContextHolder.setTenantId(SYSTEM_TENANT);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void testListTenants_ReturnsFleetPage() {
        FleetTenantSummaryDto summary = FleetTenantSummaryDto.builder()
                .tenantId("tenant-acme")
                .name("Acme Corp")
                .tier("PRO")
                .status("ACTIVE")
                .maxWorkspaces(5)
                .maxSchemas(50)
                .maxRecords(100_000L)
                .build();
        Page<FleetTenantSummaryDto> page = new PageImpl<>(List.of(summary));

        when(fleetService.listFleetTenants(isNull(), isNull(), isNull(), any(Pageable.class))).thenReturn(page);

        ResponseEntity<ResponseWrapper<ContextHeader, Page<FleetTenantSummaryDto>>> response =
                controller.listTenants(null, null, null, PageRequest.of(0, 10));

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
        assertEquals(1, response.getBody().getBody().getTotalElements());
        assertEquals("tenant-acme", response.getBody().getBody().getContent().get(0).getTenantId());
        verify(fleetService, times(1)).listFleetTenants(isNull(), isNull(), isNull(), any(Pageable.class));
    }

    @Test
    void testCreateTenant_ProvisionsNewTenant() {
        CreateTenantRequest request = CreateTenantRequest.builder()
                .tenantId("tenant-new")
                .tenantName("New Corp")
                .tier("BASIC")
                .blueprintId("ecommerce-standard")
                .build();

        FleetTenantSummaryDto created = FleetTenantSummaryDto.builder()
                .tenantId("tenant-new")
                .name("New Corp")
                .tier("BASIC")
                .status("ACTIVE")
                .build();

        when(fleetService.createTenant(any(CreateTenantRequest.class))).thenReturn(created);

        ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> response = controller.createTenant(request);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("tenant-new", response.getBody().getBody().getTenantId());
        verify(fleetService, times(1)).createTenant(request);
    }

    @Test
    void testGetTenantDiagnostics_ReturnsDiagnostics() {
        FleetTenantSummaryDto diag = FleetTenantSummaryDto.builder()
                .tenantId(TARGET_TENANT)
                .tier("PRO")
                .status("ACTIVE")
                .cpuUsagePercent(4.2)
                .storageBytes(2048576L)
                .build();

        when(fleetService.getFleetTenantDiagnostics(TARGET_TENANT)).thenReturn(diag);

        ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> response =
                controller.getTenantDiagnostics(TARGET_TENANT);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(TARGET_TENANT, response.getBody().getBody().getTenantId());
        verify(fleetService, times(1)).getFleetTenantDiagnostics(TARGET_TENANT);
    }

    @Test
    void testUpdateTenantStatus_TogglesStatus() {
        UpdateTenantStatusRequest request = UpdateTenantStatusRequest.builder()
                .status("SUSPENDED")
                .reason("Billing overdue delinquency")
                .build();

        FleetTenantSummaryDto suspended = FleetTenantSummaryDto.builder()
                .tenantId(TARGET_TENANT)
                .status("SUSPENDED")
                .build();

        when(fleetService.updateTenantStatus(eq(TARGET_TENANT), any(UpdateTenantStatusRequest.class)))
                .thenReturn(suspended);

        ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> response =
                controller.updateTenantStatus(TARGET_TENANT, request);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("SUSPENDED", response.getBody().getBody().getStatus());
        verify(fleetService, times(1)).updateTenantStatus(TARGET_TENANT, request);
    }

    @Test
    void testOverrideSubscription_LiftsTier() {
        OverrideSubscriptionRequest request = OverrideSubscriptionRequest.builder()
                .planTier("ENTERPRISE")
                .features(List.of("FEATURE_METADATA_READ", "FEATURE_AI_AGENT_MCP"))
                .reason("Strategic Partner VIP upgrade")
                .build();

        FleetTenantSummaryDto upgraded = FleetTenantSummaryDto.builder()
                .tenantId(TARGET_TENANT)
                .tier("ENTERPRISE")
                .build();

        when(fleetService.overrideSubscription(eq(TARGET_TENANT), any(OverrideSubscriptionRequest.class)))
                .thenReturn(upgraded);

        ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> response =
                controller.overrideSubscription(TARGET_TENANT, request);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("ENTERPRISE", response.getBody().getBody().getTier());
        verify(fleetService, times(1)).overrideSubscription(TARGET_TENANT, request);
    }

    @Test
    void testUpdateTenantQuotas_SetsCustomQuotas() {
        UpdateTenantQuotasRequest request = UpdateTenantQuotasRequest.builder()
                .maxWorkspaces(25)
                .maxSchemas(500)
                .maxRecords(5_000_000L)
                .reason("Sovereign Custodian capacity grant")
                .build();

        FleetTenantSummaryDto updated = FleetTenantSummaryDto.builder()
                .tenantId(TARGET_TENANT)
                .maxWorkspaces(25)
                .maxSchemas(500)
                .maxRecords(5_000_000L)
                .build();

        when(fleetService.updateTenantQuotas(eq(TARGET_TENANT), any(UpdateTenantQuotasRequest.class)))
                .thenReturn(updated);

        ResponseEntity<ResponseWrapper<ContextHeader, FleetTenantSummaryDto>> response =
                controller.updateTenantQuotas(TARGET_TENANT, request);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(25, response.getBody().getBody().getMaxWorkspaces());
        assertEquals(500, response.getBody().getBody().getMaxSchemas());
        assertEquals(5_000_000L, response.getBody().getBody().getMaxRecords());
        verify(fleetService, times(1)).updateTenantQuotas(TARGET_TENANT, request);
    }

    @Test
    void testAssumeTenant_IssuesDelegatedToken() {
        AssumeTenantRequest request = AssumeTenantRequest.builder()
                .durationMinutes(30)
                .reason("Debugging customer schema bug")
                .build();

        AssumeTenantTokenResponse tokenResp = AssumeTenantTokenResponse.builder()
                .ephemeralToken("eyJhbGciOiJIUzUxMiJ9.ephemeral")
                .actorTenantId("SYSTEM")
                .effectiveTenantId(TARGET_TENANT)
                .issuedAt(LocalDateTime.now())
                .expiresAt(LocalDateTime.now().plusMinutes(30))
                .authorities(List.of("ROLE_SYSTEM_CUSTODIAN", "ROLE_ADMIN"))
                .message("Assume-Tenant ephemeral token active")
                .build();

        when(fleetService.assumeTenant(eq(TARGET_TENANT), any(AssumeTenantRequest.class))).thenReturn(tokenResp);

        ResponseEntity<ResponseWrapper<ContextHeader, AssumeTenantTokenResponse>> response =
                controller.assumeTenant(TARGET_TENANT, request);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("SYSTEM", response.getBody().getBody().getActorTenantId());
        assertEquals(TARGET_TENANT, response.getBody().getBody().getEffectiveTenantId());
        assertEquals("eyJhbGciOiJIUzUxMiJ9.ephemeral", response.getBody().getBody().getEphemeralToken());
        verify(fleetService, times(1)).assumeTenant(TARGET_TENANT, request);
    }

    @Test
    void testListRoles_ReturnsMatrixRoles() {
        RoleWithPermissionsDto role = RoleWithPermissionsDto.builder()
                .roleId("ROLE_SYSTEM_CUSTODIAN")
                .roleName("Sovereign Custodian")
                .systemRole(true)
                .permissions(List.of("platform:fleet:read", "platform:fleet:mutate"))
                .build();

        when(fleetService.listRoles()).thenReturn(List.of(role));

        ResponseEntity<ResponseWrapper<ContextHeader, List<RoleWithPermissionsDto>>> response =
                controller.listRoles();

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(1, response.getBody().getBody().size());
        assertEquals("ROLE_SYSTEM_CUSTODIAN", response.getBody().getBody().get(0).getRoleId());
        verify(fleetService, times(1)).listRoles();
    }

    @Test
    void testUpdateRolePermissions_UpdatesBindings() {
        UpdateRolePermissionsRequest request = UpdateRolePermissionsRequest.builder()
                .permissions(List.of("METADATA_SCHEMA_READ", "METADATA_RECORD_READ"))
                .reason("Tighten read-only permissions")
                .build();

        RoleWithPermissionsDto updated = RoleWithPermissionsDto.builder()
                .roleId("ROLE_READONLY")
                .roleName("Auditor")
                .permissions(List.of("METADATA_SCHEMA_READ", "METADATA_RECORD_READ"))
                .build();

        when(fleetService.updateRolePermissions(eq("ROLE_READONLY"), any(UpdateRolePermissionsRequest.class)))
                .thenReturn(updated);

        ResponseEntity<ResponseWrapper<ContextHeader, RoleWithPermissionsDto>> response =
                controller.updateRolePermissions("ROLE_READONLY", request);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals(2, response.getBody().getBody().getPermissions().size());
        verify(fleetService, times(1)).updateRolePermissions("ROLE_READONLY", request);
    }

    @Test
    void testCreateRole_ReturnsSuccess() {
        CreateRoleRequest request = CreateRoleRequest.builder()
                .roleId("ROLE_COMPLIANCE_AUDITOR")
                .roleName("Compliance Auditor")
                .description("Audit compliance inspector")
                .permissions(List.of("platform:fleet:read", "METADATA_SCHEMA_READ"))
                .inheritedRoles(List.of("ROLE_USER"))
                .build();

        RoleWithPermissionsDto created = RoleWithPermissionsDto.builder()
                .roleId("ROLE_COMPLIANCE_AUDITOR")
                .roleName("Compliance Auditor")
                .description("Audit compliance inspector")
                .systemRole(false)
                .permissions(List.of("platform:fleet:read", "METADATA_SCHEMA_READ"))
                .inheritedRoles(List.of("ROLE_USER"))
                .userCount(0)
                .build();

        when(fleetService.createRole(any(CreateRoleRequest.class))).thenReturn(created);

        ResponseEntity<ResponseWrapper<ContextHeader, RoleWithPermissionsDto>> response =
                controller.createRole(request);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertEquals("ROLE_COMPLIANCE_AUDITOR", response.getBody().getBody().getRoleId());
        assertEquals("Compliance Auditor", response.getBody().getBody().getRoleName());
        assertFalse(response.getBody().getBody().isSystemRole());
        verify(fleetService, times(1)).createRole(request);
    }

    @Test
    void testLockUser_MutatesLockedStatus() {
        LockUserRequest request = LockUserRequest.builder()
                .locked(true)
                .reason("Security anomaly detected")
                .build();

        GlobalUserListItemDto lockedUser = GlobalUserListItemDto.builder()
                .userId("usr-123")
                .locked(true)
                .build();

        when(fleetService.lockUser(eq("usr-123"), any(LockUserRequest.class))).thenReturn(lockedUser);

        ResponseEntity<ResponseWrapper<ContextHeader, GlobalUserListItemDto>> response =
                controller.lockUser("usr-123", request);

        assertNotNull(response);
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertTrue(response.getBody().getBody().isLocked());
        verify(fleetService, times(1)).lockUser("usr-123", request);
    }
}
