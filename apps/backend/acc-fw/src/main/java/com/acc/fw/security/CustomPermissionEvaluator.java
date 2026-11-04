package com.acc.fw.security;

import com.acc.core.constant.PermissionActionConstants;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;

import java.io.Serializable;

public class CustomPermissionEvaluator implements PermissionEvaluator {
  @Override
  public boolean hasPermission(Authentication auth, Object targetDomainObject, Object permission) {
    if ((auth == null) || !(targetDomainObject instanceof String) || (targetDomainObject == null) || !(permission instanceof String)) {
      return false;
    }
    String targetType = (String) targetDomainObject;
    return hasPrivilege(auth, targetType, permission.toString());
  }

  @Override
  public boolean hasPermission(Authentication auth, Serializable targetId, String targetDomainObject, Object permission) {
    if ((auth == null) || !(targetDomainObject instanceof String) || (targetDomainObject == null) || !(permission instanceof String)) {
      return false;
    }
    String targetType = (String) targetDomainObject;
    return hasPrivilege(auth, targetType, permission.toString());
  }

  private boolean hasPrivilege(Authentication auth, String targetType, String permission) {
    String combiPermission = (targetType + "_" + permission).toUpperCase();
    String colonPermission = (targetType + ":" + permission).toLowerCase();
    if (auth != null && auth.getAuthorities() != null) {
      return auth.getAuthorities()
                 .stream()
                 .anyMatch(grant -> {
                   String a = grant.getAuthority();
                   return a.equalsIgnoreCase(combiPermission)
                       || a.equalsIgnoreCase(colonPermission)
                       || a.equalsIgnoreCase("ROLE_SYSTEM_ROOT")
                       || a.equalsIgnoreCase("ROLE_ADMINISTRATOR")
                       || (permission.equalsIgnoreCase(PermissionActionConstants.LIST) && a.equalsIgnoreCase("ROLE_ADMINISTRATOR"));
                 });
    }
    return false;
  }
}
