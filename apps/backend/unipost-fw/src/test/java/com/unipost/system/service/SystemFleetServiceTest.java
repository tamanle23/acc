package com.unipost.system.service;

import com.unipost.domain.AuthenticationToken;
import com.unipost.domain.billing.TenantBilling;
import com.unipost.fw.core.jwt.JwtTokenHelper;
import com.unipost.fw.tenancy.ratelimit.TenantRateLimitService;
import com.unipost.repository.jpa.EntityRecordRepository;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.repository.jpa.TenantBillingRepository;
import com.unipost.repository.jpa.TenantFeatureRepository;
import com.unipost.service.exception.MetadataConflictException;
import com.unipost.service.exception.MetadataNotFoundException;
import com.unipost.system.dto.*;
import com.unipost.tenant.billing.TenantEntitlementService;
import com.unipost.tenant.dto.TenantProvisioningRequest;
import com.unipost.tenant.dto.TenantProvisioningResult;
import com.unipost.tenant.service.TenantProvisioningService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SystemFleetServiceTest {

    @Mock
    private TenantBillingRepository billingRepository;
    @Mock
    private TenantFeatureRepository featureRepository;
    @Mock
    private EntityTypeRepository entityTypeRepository;
    @Mock
    private EntityRecordRepository entityRecordRepository;
    @Mock
    private TenantEntitlementService entitlementService;
    @Mock
    private TenantProvisioningService provisioningService;
    @Mock
    private TenantRateLimitService rateLimitService;
    @Mock
    private JwtTokenHelper jwtTokenHelper;

    private SystemFleetService service;

    @BeforeEach
    void setUp() {
        service = new SystemFleetService(
                billingRepository,
                featureRepository,
                entityTypeRepository,
                entityRecordRepository,
                entitlementService,
                provisioningService,
                rateLimitService,
                jwtTokenHelper
        );
    }

    @Test
    void testListFleetTenants_WithFiltersAndPaging() {
        TenantBilling b1 = new TenantBilling();
        b1.setTenantId("tenant-alpha");
        b1.setPlanTier("PRO");
        b1.setStatus("ACTIVE");

        TenantBilling b2 = new TenantBilling();
        b2.setTenantId("tenant-beta");
        b2.setPlanTier("BASIC");
        b2.setStatus("SUSPENDED");

        List<TenantBilling> billings = new ArrayList<>(List.of(b1, b2));
        when(billingRepository.findAll()).thenReturn(billings);
        when(entitlementService.getEntitledFeatures(anyString())).thenReturn(Set.of("feature:test"));

        Pageable pageable = PageRequest.of(0, 10);
        Page<FleetTenantSummaryDto> page = service.listFleetTenants("alpha", "PRO", "ACTIVE", pageable);

        assertThat(page.getTotalElements()).isEqualTo(1);
        assertThat(page.getContent().get(0).getTenantId()).isEqualTo("tenant-alpha");
        assertThat(page.getContent().get(0).getTier()).isEqualTo("PRO");
    }

    @Test
    void testListFleetTenants_AutoInjectsSystemTenantWhenMissing() {
        TenantBilling b1 = new TenantBilling();
        b1.setTenantId("tenant-gamma");
        b1.setPlanTier("ENTERPRISE");
        b1.setStatus("ACTIVE");

        when(billingRepository.findAll()).thenReturn(new ArrayList<>(List.of(b1)));
        when(entitlementService.getEntitledFeatures(anyString())).thenReturn(Set.of());

        Page<FleetTenantSummaryDto> page = service.listFleetTenants(null, null, null, PageRequest.of(0, 10));

        assertThat(page.getTotalElements()).isEqualTo(2);
        assertThat(page.getContent().stream().anyMatch(t -> "SYSTEM".equals(t.getTenantId()))).isTrue();
    }

    @Test
    void testCreateTenant_Success() {
        CreateTenantRequest request = CreateTenantRequest.builder()
                .tenantId("tenant-new")
                .tenantName("New Org")
                .tier("PRO")
                .blueprintId("ecommerce-standard")
                .build();

        when(billingRepository.existsById("tenant-new")).thenReturn(false);
        when(provisioningService.provisionTenant(any(TenantProvisioningRequest.class)))
                .thenReturn(new TenantProvisioningResult(
                        "tenant-new", "New Org", "ecommerce-standard", "Ecommerce Standard",
                        5, 10, 2, List.of("customer", "order"), "ws-1", "Default Workspace", 120L
                ));
        when(billingRepository.findById("tenant-new")).thenAnswer(inv -> {
            TenantBilling b = new TenantBilling();
            b.setTenantId("tenant-new");
            b.setPlanTier("PRO");
            b.setStatus("ACTIVE");
            return Optional.of(b);
        });
        when(entitlementService.getEntitledFeatures("tenant-new")).thenReturn(Set.of("feature:1"));

        FleetTenantSummaryDto result = service.createTenant(request);

        assertThat(result.getTenantId()).isEqualTo("tenant-new");
        assertThat(result.getTier()).isEqualTo("PRO");
        verify(billingRepository).save(any(TenantBilling.class));
        verify(entitlementService).grantFeatures(eq("tenant-new"), anySet());
    }

    @Test
    void testCreateTenant_WhenAlreadyExists_ThrowsConflict() {
        CreateTenantRequest request = CreateTenantRequest.builder()
                .tenantId("tenant-existing")
                .tenantName("Existing Org")
                .build();

        when(billingRepository.existsById("tenant-existing")).thenReturn(true);

        assertThatThrownBy(() -> service.createTenant(request))
                .isInstanceOf(MetadataConflictException.class)
                .hasMessageContaining("Tenant already exists");
    }

    @Test
    void testGetFleetTenantDiagnostics_SystemTenantFallback() {
        when(billingRepository.findById("system")).thenReturn(Optional.empty());

        FleetTenantSummaryDto diagnostics = service.getFleetTenantDiagnostics("system");

        assertThat(diagnostics.getTenantId()).isEqualTo("SYSTEM");
        assertThat(diagnostics.getTier()).isEqualTo("ENTERPRISE");
    }

    @Test
    void testGetFleetTenantDiagnostics_NotFound_ThrowsException() {
        when(billingRepository.findById("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getFleetTenantDiagnostics("unknown"))
                .isInstanceOf(MetadataNotFoundException.class)
                .hasMessageContaining("Tenant not found");
    }

    @Test
    void testUpdateTenantStatus_SystemCannotBeSuspended() {
        UpdateTenantStatusRequest req = UpdateTenantStatusRequest.builder()
                .status("SUSPENDED")
                .reason("Test")
                .build();

        assertThatThrownBy(() -> service.updateTenantStatus("system", req))
                .isInstanceOf(MetadataConflictException.class)
                .hasMessageContaining("SYSTEM tenant status cannot be altered");
    }

    @Test
    void testUpdateTenantStatus_Success() {
        TenantBilling billing = new TenantBilling();
        billing.setTenantId("tenant-cust");
        billing.setStatus("ACTIVE");
        billing.setPlanTier("BASIC");

        when(billingRepository.findById("tenant-cust")).thenReturn(Optional.of(billing));

        UpdateTenantStatusRequest req = UpdateTenantStatusRequest.builder()
                .status("SUSPENDED")
                .reason("Non-payment")
                .build();

        FleetTenantSummaryDto result = service.updateTenantStatus("tenant-cust", req);

        assertThat(result.getStatus()).isEqualTo("SUSPENDED");
        verify(billingRepository).save(billing);
        verify(entitlementService).invalidateCache("tenant-cust");
    }

    @Test
    void testOverrideSubscription_Success() {
        TenantBilling billing = new TenantBilling();
        billing.setTenantId("tenant-cust");
        billing.setStatus("ACTIVE");
        billing.setPlanTier("BASIC");

        when(billingRepository.findById("tenant-cust")).thenReturn(Optional.of(billing));

        OverrideSubscriptionRequest req = OverrideSubscriptionRequest.builder()
                .planTier("ENTERPRISE")
                .reason("Enterprise upgrade contract")
                .features(List.of("feature:advanced-analytics", "feature:custom-domains"))
                .build();

        FleetTenantSummaryDto result = service.overrideSubscription("tenant-cust", req);

        assertThat(result.getTier()).isEqualTo("ENTERPRISE");
        verify(entitlementService).grantFeatures(eq("tenant-cust"), anySet());
        verify(entitlementService).invalidateCache("tenant-cust");
    }

    @Test
    void testUpdateTenantQuotas_OverridesAndResetsRateLimit() {
        TenantBilling billing = new TenantBilling();
        billing.setTenantId("tenant-quotas");
        billing.setStatus("ACTIVE");
        billing.setPlanTier("BASIC");

        when(billingRepository.existsById("tenant-quotas")).thenReturn(true);
        when(billingRepository.findById("tenant-quotas")).thenReturn(Optional.of(billing));

        UpdateTenantQuotasRequest req = UpdateTenantQuotasRequest.builder()
                .maxWorkspaces(20)
                .maxSchemas(100)
                .maxRecords(500_000L)
                .rateLimitBurst(2000)
                .rateLimitReplenishRate(100)
                .reason("VIP Customer expansion")
                .build();

        FleetTenantSummaryDto result = service.updateTenantQuotas("tenant-quotas", req);

        assertThat(result.getMaxWorkspaces()).isEqualTo(20);
        assertThat(result.getMaxSchemas()).isEqualTo(100);
        assertThat(result.getMaxRecords()).isEqualTo(500_000L);
        verify(rateLimitService).reset("tenant-quotas");
    }

    @Test
    void testAssumeTenant_SuccessGeneratesEphemeralToken() {
        when(billingRepository.existsById("tenant-cust")).thenReturn(true);

        AuthenticationToken authToken = AuthenticationToken.builder()
                .accessToken("sample-jwt-token")
                .refreshToken("refresh-token")
                .tokenAge(3600L)
                .build();
        when(jwtTokenHelper.getAuthenticationToken(anyMap())).thenReturn(authToken);

        AssumeTenantRequest req = AssumeTenantRequest.builder()
                .durationMinutes(60)
                .reason("Urgent production debugging")
                .build();

        AssumeTenantTokenResponse response = service.assumeTenant("tenant-cust", req);

        assertThat(response.getEphemeralToken()).isEqualTo("sample-jwt-token");
        assertThat(response.getEffectiveTenantId()).isEqualTo("tenant-cust");
        assertThat(response.getActorTenantId()).isEqualTo("SYSTEM");
        assertThat(response.getAuthorities()).contains("ROLE_SYSTEM_CUSTODIAN");
    }

    @Test
    void testRbacRoleOperations_ListCreateUpdate() {
        List<RoleWithPermissionsDto> defaultRoles = service.listRoles();
        assertThat(defaultRoles).isNotEmpty();

        CreateRoleRequest newRoleReq = CreateRoleRequest.builder()
                .roleId("ROLE_SUPPORT")
                .roleName("Support Specialist")
                .description("Customer support read-only access")
                .permissions(List.of("METADATA_RECORD_READ"))
                .inheritedRoles(List.of("ROLE_USER"))
                .build();

        RoleWithPermissionsDto created = service.createRole(newRoleReq);
        assertThat(created.getRoleId()).isEqualTo("ROLE_SUPPORT");
        assertThat(created.getPermissions()).contains("METADATA_RECORD_READ");

        // Duplicate role throws conflict
        assertThatThrownBy(() -> service.createRole(newRoleReq))
                .isInstanceOf(MetadataConflictException.class);

        // Update permissions
        UpdateRolePermissionsRequest updateReq = UpdateRolePermissionsRequest.builder()
                .permissions(List.of("METADATA_RECORD_READ", "METADATA_SCHEMA_READ"))
                .inheritedRoles(List.of("ROLE_USER"))
                .reason("Extended support capabilities")
                .build();

        RoleWithPermissionsDto updated = service.updateRolePermissions("ROLE_SUPPORT", updateReq);
        assertThat(updated.getPermissions()).contains("METADATA_SCHEMA_READ");

        // Non-existent role throws not found
        assertThatThrownBy(() -> service.updateRolePermissions("ROLE_NONEXISTENT", updateReq))
                .isInstanceOf(MetadataNotFoundException.class);
    }

    @Test
    void testGlobalUsersOperations_ListAndLock() {
        Page<GlobalUserListItemDto> usersPage = service.listGlobalUsers(null, null, PageRequest.of(0, 10));
        assertThat(usersPage.getContent()).isNotEmpty();

        GlobalUserListItemDto firstUser = usersPage.getContent().get(0);
        String userId = firstUser.getUserId();

        LockUserRequest lockReq = LockUserRequest.builder()
                .locked(true)
                .reason("Suspicious activity audit")
                .build();

        GlobalUserListItemDto lockedUser = service.lockUser(userId, lockReq);
        assertThat(lockedUser.isLocked()).isTrue();

        // Lock non-existent user throws not found
        assertThatThrownBy(() -> service.lockUser("usr_unknown_999", lockReq))
                .isInstanceOf(MetadataNotFoundException.class);
    }
}
