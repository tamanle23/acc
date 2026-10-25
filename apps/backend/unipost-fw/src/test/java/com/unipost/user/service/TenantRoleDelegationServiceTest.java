package com.unipost.user.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.unipost.identity.infra.user.repository.jpa.PermissionRepository;
import com.unipost.identity.infra.user.repository.jpa.RoleRepository;
import com.unipost.identity.infra.user.repository.jpa.UserPermissionRepository;
import com.unipost.identity.infra.user.repository.jpa.UserRepository;
import com.unipost.identity.infra.user.repository.jpa.UserRoleRepository;
import com.unipost.user.model.Permission;
import com.unipost.user.model.Role;
import com.unipost.user.model.User;
import com.unipost.user.model.UserRole;
import com.unipost.user.service.TenantRoleDelegationService.PermissionOverrideDto;
import com.unipost.user.service.TenantRoleDelegationService.UserDelegationPayload;
import com.unipost.user.service.TenantRoleDelegationService.UserDelegationResult;
import com.unipost.user.service.impl.TenantRoleDelegationServiceImpl;

class TenantRoleDelegationServiceTest {

  private UserRepository userRepository;
  private RoleRepository roleRepository;
  private UserRoleRepository userRoleRepository;
  private UserPermissionRepository userPermissionRepository;
  private PermissionRepository permissionRepository;
  private TenantRoleDelegationServiceImpl service;

  private User bob;
  private User alice;
  private Role opsManagerRole;
  private Role systemRootRole;
  private Permission recordCreatePerm;
  private Permission fleetMutatePerm;

  @BeforeEach
  void setUp() {
    userRepository = mock(UserRepository.class);
    roleRepository = mock(RoleRepository.class);
    userRoleRepository = mock(UserRoleRepository.class);
    userPermissionRepository = mock(UserPermissionRepository.class);
    permissionRepository = mock(PermissionRepository.class);

    service = new TenantRoleDelegationServiceImpl(
        userRepository,
        roleRepository,
        userRoleRepository,
        userPermissionRepository,
        permissionRepository
    );

    bob = new User();
    bob.setUserName("bob@acme.com");
    bob.setUid("usr-bob");

    alice = new User();
    alice.setUserName("alice@acme.com");
    alice.setUid("usr-alice");

    recordCreatePerm = new Permission();
    recordCreatePerm.setCode("entity:record:create");

    fleetMutatePerm = new Permission();
    fleetMutatePerm.setCode("platform:fleet:mutate");

    opsManagerRole = new Role();
    opsManagerRole.setCode("ROLE_OPERATIONS_MANAGER");
    opsManagerRole.setRoleScope("TENANT");
    opsManagerRole.setTenantId("SYSTEM");
    opsManagerRole.setPermissions(Set.of(recordCreatePerm));

    systemRootRole = new Role();
    systemRootRole.setCode("ROLE_SYSTEM_ROOT");
    systemRootRole.setRoleScope("SYSTEM");
    systemRootRole.setTenantId("SYSTEM");
    systemRootRole.setPermissions(Set.of(fleetMutatePerm));

    when(userRepository.findByUid("usr-bob")).thenReturn(bob);
    when(roleRepository.findOneByCodeIgnoreCase("ROLE_OPERATIONS_MANAGER")).thenReturn(opsManagerRole);
    when(roleRepository.findOneByCodeIgnoreCase("ROLE_SYSTEM_ROOT")).thenReturn(systemRootRole);
    when(permissionRepository.findOneByCodeIgnoreCase("entity:record:create")).thenReturn(recordCreatePerm);
    when(permissionRepository.findOneByCodeIgnoreCase("platform:fleet:mutate")).thenReturn(fleetMutatePerm);
  }

  @Test
  @DisplayName("Tenant Admin delegates ROLE_OPERATIONS_MANAGER to member in same tenant -> SUCCESS")
  void testDelegateTenantRoleSuccess() {
    UserDelegationPayload payload = new UserDelegationPayload(
        List.of("ROLE_OPERATIONS_MANAGER"),
        List.of(new PermissionOverrideDto("entity:record:create", true, "Ad-hoc create rights")),
        "Promotion to ops lead"
    );

    UserDelegationResult result = service.delegateUserRoles(
        "tenant-acme",
        "usr-bob",
        payload,
        "alice",
        "tenant-acme",
        List.of("ROLE_WORKSPACE_OWNER", "entity:record:create"),
        false
    );

    assertThat(result).isNotNull();
    assertThat(result.assignedRoles()).containsExactly("ROLE_OPERATIONS_MANAGER");
    assertThat(result.activeOverrides()).hasSize(1);
    verify(userRoleRepository).deleteAllByUserAndTenantId(eq(bob), eq("tenant-acme"));
    verify(userRoleRepository).save(any());
  }

  @Test
  @DisplayName("Cross-Tenant Barrier: Tenant Admin cannot delegate roles for a different tenant -> SecurityException")
  void testCrossTenantBarrierThrows() {
    UserDelegationPayload payload = new UserDelegationPayload(
        List.of("ROLE_OPERATIONS_MANAGER"),
        Collections.emptyList(),
        "Illegal cross-tenant delegate"
    );

    assertThatThrownBy(() -> service.delegateUserRoles(
        "tenant-beta",
        "usr-bob",
        payload,
        "alice",
        "tenant-acme",
        List.of("ROLE_WORKSPACE_OWNER", "entity:record:create"),
        false
    ))
        .isInstanceOf(SecurityException.class)
        .hasMessageContaining("CROSS_TENANT_PRIVILEGE_VIOLATION");
  }

  @Test
  @DisplayName("Sovereign Role Quarantine: Tenant Admin cannot assign ROLE_SYSTEM_ROOT -> SecurityException")
  void testSovereignRoleQuarantineThrows() {
    UserDelegationPayload payload = new UserDelegationPayload(
        List.of("ROLE_SYSTEM_ROOT"),
        Collections.emptyList(),
        "Attempting root escalation"
    );

    assertThatThrownBy(() -> service.delegateUserRoles(
        "tenant-acme",
        "usr-bob",
        payload,
        "alice",
        "tenant-acme",
        List.of("ROLE_WORKSPACE_OWNER", "entity:record:create"),
        false
    ))
        .isInstanceOf(SecurityException.class)
        .hasMessageContaining("sovereign system roles");
  }

  @Test
  @DisplayName("Delegation Ceiling: Tenant Admin cannot delegate permissions they do not possess -> SecurityException")
  void testDelegationCeilingThrows() {
    UserDelegationPayload payload = new UserDelegationPayload(
        List.of("ROLE_OPERATIONS_MANAGER"),
        Collections.emptyList(),
        "Missing required perms"
    );

    // Actor does NOT hold 'entity:record:create'
    assertThatThrownBy(() -> service.delegateUserRoles(
        "tenant-acme",
        "usr-bob",
        payload,
        "alice",
        "tenant-acme",
        List.of("ROLE_WORKSPACE_OWNER"),
        false
    ))
        .isInstanceOf(SecurityException.class)
        .hasMessageContaining("DELEGATION_CEILING_EXCEEDED");
  }

  @Test
  @DisplayName("Last-Admin Protection: Cannot demote the sole active ROLE_WORKSPACE_OWNER -> IllegalStateException")
  void testLastAdminProtectionThrows() {
    Role ownerRole = new Role();
    ownerRole.setCode("ROLE_WORKSPACE_OWNER");
    ownerRole.setRoleScope("TENANT");

    UserRole existingOwnerUr = UserRole.builder()
        .user(bob)
        .role(ownerRole)
        .tenantId("tenant-acme")
        .build();

    when(userRoleRepository.findAllByTenantId("tenant-acme")).thenReturn(List.of(existingOwnerUr));

    // Payload removes ROLE_WORKSPACE_OWNER and replaces with ROLE_OPERATIONS_MANAGER
    UserDelegationPayload payload = new UserDelegationPayload(
        List.of("ROLE_OPERATIONS_MANAGER"),
        Collections.emptyList(),
        "Demote sole admin"
    );

    assertThatThrownBy(() -> service.delegateUserRoles(
        "tenant-acme",
        "usr-bob",
        payload,
        "alice",
        "tenant-acme",
        List.of("ROLE_WORKSPACE_OWNER", "entity:record:create"),
        false
    ))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("LAST_ADMIN_PROTECTION");
  }
}
