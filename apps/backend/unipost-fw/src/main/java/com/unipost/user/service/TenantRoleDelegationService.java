package com.unipost.user.service;

import java.util.List;

public interface TenantRoleDelegationService {

  record RoleDto(
      String roleId,
      String roleName,
      String description,
      boolean systemRole,
      String roleScope,
      String minPlanTier,
      String tenantId,
      List<String> permissions,
      List<String> inheritedRoles,
      int userCount
  ) {}

  record UserDelegationPayload(
      List<String> roles,
      List<PermissionOverrideDto> permissionOverrides,
      String reason
  ) {}

  record PermissionOverrideDto(
      String permissionCode,
      boolean isGranted,
      String reason
  ) {}

  record UserDelegationResult(
      String userId,
      String tenantId,
      List<String> assignedRoles,
      List<PermissionOverrideDto> activeOverrides,
      String delegatedBy,
      String reason
  ) {}

  List<RoleDto> getRolesForTenant(String tenantId, String currentActorTenantId, boolean isSovereign);

  UserDelegationResult delegateUserRoles(
      String targetTenantId,
      String targetUserId,
      UserDelegationPayload payload,
      String currentActorUsername,
      String currentActorTenantId,
      List<String> currentActorAuthorities,
      boolean isSovereign
  );

  void revokeUserTenantRole(
      String targetTenantId,
      String targetUserId,
      String roleCode,
      String currentActorUsername,
      String currentActorTenantId,
      boolean isSovereign
  );
}
