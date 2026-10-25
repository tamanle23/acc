package com.unipost.user.controller;

import java.util.Collection;
import java.util.List;
import java.util.stream.Collectors;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.unipost.user.service.TenantRoleDelegationService;
import com.unipost.user.service.TenantRoleDelegationService.RoleDto;
import com.unipost.user.service.TenantRoleDelegationService.UserDelegationPayload;
import com.unipost.user.service.TenantRoleDelegationService.UserDelegationResult;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Slf4j
@RestController
@RequestMapping("/api/v1/system/tenants/{tenantId}")
@RequiredArgsConstructor
public class TenantRoleDelegationController {

  private final TenantRoleDelegationService delegationService;

  @GetMapping("/roles")
  @PreAuthorize("hasAnyRole('SYSTEM_ROOT', 'WORKSPACE_OWNER', 'OPERATIONS_MANAGER') or hasAuthority('org:member:manage')")
  public ResponseEntity<List<RoleDto>> getTenantAssignableRoles(
      @PathVariable String tenantId,
      Authentication authentication
  ) {
    String currentActorTenantId = extractTenantId(authentication);
    boolean isSovereign = isSovereign(authentication);

    List<RoleDto> roles = delegationService.getRolesForTenant(tenantId, currentActorTenantId, isSovereign);
    return ResponseEntity.ok(roles);
  }

  @PutMapping("/users/{userId}/delegation")
  @PreAuthorize("hasAnyRole('SYSTEM_ROOT', 'WORKSPACE_OWNER') or hasAuthority('org:member:manage')")
  public ResponseEntity<UserDelegationResult> delegateUserRolesAndOverrides(
      @PathVariable String tenantId,
      @PathVariable String userId,
      @Valid @RequestBody UserDelegationPayload payload,
      Authentication authentication
  ) {
    String currentActorUsername = authentication != null ? authentication.getName() : "anonymous";
    String currentActorTenantId = extractTenantId(authentication);
    boolean isSovereign = isSovereign(authentication);

    List<String> actorAuthorities = authentication != null
        ? authentication.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toList())
        : List.of();

    UserDelegationResult result = delegationService.delegateUserRoles(
        tenantId,
        userId,
        payload,
        currentActorUsername,
        currentActorTenantId,
        actorAuthorities,
        isSovereign
    );

    return ResponseEntity.ok(result);
  }

  private String extractTenantId(Authentication authentication) {
    if (authentication == null) return "SYSTEM";
    // Check authorities or default to principal tenant
    for (GrantedAuthority ga : authentication.getAuthorities()) {
      if (ga.getAuthority().startsWith("TENANT_")) {
        return ga.getAuthority().replace("TENANT_", "");
      }
    }
    return "SYSTEM";
  }

  private boolean isSovereign(Authentication authentication) {
    if (authentication == null) return false;
    Collection<? extends GrantedAuthority> authorities = authentication.getAuthorities();
    return authorities.stream().anyMatch(a ->
        "ROLE_SYSTEM_ROOT".equalsIgnoreCase(a.getAuthority()) ||
        "ROLE_SYSTEM_CUSTODIAN".equalsIgnoreCase(a.getAuthority())
    );
  }
}
