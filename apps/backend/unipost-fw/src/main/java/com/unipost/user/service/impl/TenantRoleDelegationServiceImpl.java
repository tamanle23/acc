package com.unipost.user.service.impl;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.unipost.identity.infra.user.repository.jpa.PermissionRepository;
import com.unipost.identity.infra.user.repository.jpa.RoleRepository;
import com.unipost.identity.infra.user.repository.jpa.UserPermissionRepository;
import com.unipost.identity.infra.user.repository.jpa.UserRepository;
import com.unipost.identity.infra.user.repository.jpa.UserRoleRepository;
import com.unipost.user.model.Permission;
import com.unipost.user.model.Role;
import com.unipost.user.model.User;
import com.unipost.user.model.UserPermission;
import com.unipost.user.model.UserRole;
import com.unipost.user.service.TenantRoleDelegationService;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@Service
@RequiredArgsConstructor
public class TenantRoleDelegationServiceImpl implements TenantRoleDelegationService {

  private final UserRepository userRepository;
  private final RoleRepository roleRepository;
  private final UserRoleRepository userRoleRepository;
  private final UserPermissionRepository userPermissionRepository;
  private final PermissionRepository permissionRepository;

  @Override
  @Transactional(readOnly = true)
  public List<RoleDto> getRolesForTenant(String tenantId, String currentActorTenantId, boolean isSovereign) {
    if (!isSovereign && !tenantId.equalsIgnoreCase(currentActorTenantId)) {
      throw new SecurityException("Cross-tenant access forbidden: actor tenant " + currentActorTenantId + " cannot inspect roles for " + tenantId);
    }

    List<Role> allRoles;
    if (isSovereign && "SYSTEM".equalsIgnoreCase(tenantId)) {
      allRoles = roleRepository.findAll();
    } else {
      // Return system-wide tenant roles OR custom roles created for this tenant
      allRoles = roleRepository.findAllByRoleScopeOrTenantId("TENANT", tenantId);
    }

    return allRoles.stream()
        .map(r -> new RoleDto(
            r.getCode(),
            r.getDescription() != null ? r.getDescription() : r.getCode(),
            r.getDescription(),
            "SYSTEM".equalsIgnoreCase(r.getTenantId()) && "SYSTEM".equalsIgnoreCase(r.getRoleScope()),
            r.getRoleScope() != null ? r.getRoleScope() : "TENANT",
            r.getMinPlanTier() != null ? r.getMinPlanTier() : "COMMUNITY",
            r.getTenantId() != null ? r.getTenantId() : "SYSTEM",
            r.getPermissions() != null
                ? r.getPermissions().stream().map(Permission::getCode).collect(Collectors.toList())
                : Collections.emptyList(),
            Collections.emptyList(),
            0
        ))
        .collect(Collectors.toList());
  }

  @Override
  @Transactional
  public UserDelegationResult delegateUserRoles(
      String targetTenantId,
      String targetUserId,
      UserDelegationPayload payload,
      String currentActorUsername,
      String currentActorTenantId,
      List<String> currentActorAuthorities,
      boolean isSovereign
  ) {
    // 1. Cross-Tenant Barrier
    if (!isSovereign && !targetTenantId.equalsIgnoreCase(currentActorTenantId)) {
      throw new SecurityException("CROSS_TENANT_PRIVILEGE_VIOLATION: Cannot delegate roles to a different tenant");
    }

    User resolved = userRepository.findByUid(targetUserId);
    if (resolved == null) {
      resolved = userRepository.findByUserName(targetUserId);
    }
    if (resolved == null) {
      throw new IllegalArgumentException("Target user not found: " + targetUserId);
    }
    final User targetUser = resolved;

    // 3. Last-Admin Soft Lock: Count existing active ROLE_WORKSPACE_OWNER in this tenant
    List<UserRole> existingTenantRoles = userRoleRepository.findAllByTenantId(targetTenantId);
    long ownerCount = existingTenantRoles.stream()
        .filter(ur -> ur.getRole() != null && "ROLE_WORKSPACE_OWNER".equalsIgnoreCase(ur.getRole().getCode()))
        .map(ur -> ur.getUser().getUid())
        .distinct()
        .count();

    boolean targetCurrentlyOwner = existingTenantRoles.stream()
        .anyMatch(ur -> ur.getUser().getUid().equals(targetUser.getUid())
            && ur.getRole() != null && "ROLE_WORKSPACE_OWNER".equalsIgnoreCase(ur.getRole().getCode()));

    boolean targetWillBeOwner = payload.roles() != null
        && payload.roles().stream().anyMatch(r -> "ROLE_WORKSPACE_OWNER".equalsIgnoreCase(r));

    if (targetCurrentlyOwner && !targetWillBeOwner && ownerCount <= 1) {
      throw new IllegalStateException("LAST_ADMIN_PROTECTION: Cannot demote or revoke the sole active ROLE_WORKSPACE_OWNER in tenant " + targetTenantId);
    }

    // 4. Subordinate Delegation Boundary (Delegation Ceiling)
    Set<String> actorPerms = new HashSet<>(currentActorAuthorities);
    List<Role> resolvedRoles = new ArrayList<>();
    if (payload.roles() != null) {
      for (String roleCode : payload.roles()) {
        Role role = roleRepository.findOneByCodeIgnoreCase(roleCode);
        if (role == null) {
          throw new IllegalArgumentException("Unknown role code: " + roleCode);
        }

        // Sovereign role quarantine: non-sovereign caller cannot grant role_scope = SYSTEM
        if (!isSovereign && "SYSTEM".equalsIgnoreCase(role.getRoleScope())) {
          throw new SecurityException("CROSS_TENANT_PRIVILEGE_VIOLATION: Non-sovereign administrator cannot grant sovereign system roles");
        }

        // Subordinate ceiling: non-sovereign caller cannot grant permissions they do not possess
        if (!isSovereign && role.getPermissions() != null) {
          for (Permission perm : role.getPermissions()) {
            if (!actorPerms.contains(perm.getCode())) {
              throw new SecurityException("DELEGATION_CEILING_EXCEEDED: Cannot delegate role '" + roleCode + "' containing unheld permission '" + perm.getCode() + "'");
            }
          }
        }
        resolvedRoles.add(role);
      }
    }

    // 5. Atomic Persistence for Roles stamped with targetTenantId
    userRoleRepository.deleteAllByUserAndTenantId(targetUser, targetTenantId);
    for (Role role : resolvedRoles) {
      UserRole userRole = UserRole.builder()
          .user(targetUser)
          .role(role)
          .tenantId(targetTenantId)
          .build();
      userRole.setUid("ur-" + UUID.randomUUID().toString());
      userRoleRepository.save(userRole);
    }

    // 6. Ad-Hoc Permission Overrides
    userPermissionRepository.deleteAllByUserAndTenantId(targetUser, targetTenantId);
    List<PermissionOverrideDto> savedOverrides = new ArrayList<>();
    if (payload.permissionOverrides() != null) {
      for (PermissionOverrideDto override : payload.permissionOverrides()) {
        Permission perm = permissionRepository.findOneByCodeIgnoreCase(override.permissionCode());
        if (perm == null) {
          throw new IllegalArgumentException("Unknown permission code for override: " + override.permissionCode());
        }

        // Subordinate check for ad-hoc grants: cannot grant what actor doesn't hold
        if (!isSovereign && override.isGranted() && !actorPerms.contains(perm.getCode())) {
          throw new SecurityException("DELEGATION_CEILING_EXCEEDED: Cannot grant ad-hoc permission '" + perm.getCode() + "'");
        }

        UserPermission userPerm = UserPermission.builder()
            .user(targetUser)
            .permission(perm)
            .tenantId(targetTenantId)
            .isGranted(override.isGranted())
            .delegatedByUid(currentActorUsername)
            .reason(override.reason() != null ? override.reason() : payload.reason())
            .build();
        userPerm.setUid("up-" + UUID.randomUUID().toString());
        userPermissionRepository.save(userPerm);
        savedOverrides.add(override);
      }
    }

    log.info("Successfully delegated {} roles and {} permission overrides to user {} in tenant {}",
        resolvedRoles.size(), savedOverrides.size(), targetUser.getUserName(), targetTenantId);

    return new UserDelegationResult(
        targetUser.getUid(),
        targetTenantId,
        resolvedRoles.stream().map(Role::getCode).collect(Collectors.toList()),
        savedOverrides,
        currentActorUsername,
        payload.reason()
    );
  }

  @Override
  @Transactional
  public void revokeUserTenantRole(
      String targetTenantId,
      String targetUserId,
      String roleCode,
      String currentActorUsername,
      String currentActorTenantId,
      boolean isSovereign
  ) {
    if (!isSovereign && !targetTenantId.equalsIgnoreCase(currentActorTenantId)) {
      throw new SecurityException("CROSS_TENANT_PRIVILEGE_VIOLATION: Cannot revoke role for a different tenant");
    }

    User targetUser = userRepository.findByUid(targetUserId);
    if (targetUser == null) {
      targetUser = userRepository.findByUserName(targetUserId);
    }
    if (targetUser == null) {
      throw new IllegalArgumentException("Target user not found: " + targetUserId);
    }

    List<UserRole> currentRoles = userRoleRepository.findAllByUserAndTenantId(targetUser, targetTenantId);
    List<String> remainingRoles = currentRoles.stream()
        .filter(ur -> ur.getRole() != null && !roleCode.equalsIgnoreCase(ur.getRole().getCode()))
        .map(ur -> ur.getRole().getCode())
        .collect(Collectors.toList());

    delegateUserRoles(
        targetTenantId,
        targetUserId,
        new UserDelegationPayload(remainingRoles, Collections.emptyList(), "Revoked role " + roleCode),
        currentActorUsername,
        currentActorTenantId,
        Collections.emptyList(),
        isSovereign
    );
  }
}
