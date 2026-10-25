package com.acc.identity.infra.user.repository.jpa;

import com.acc.repository.jpa.NamedModelBaseRepository;
import com.acc.user.model.Role;

public interface RoleRepository extends NamedModelBaseRepository<Role> {

  public Role findOneByCodeIgnoreCase(String string);

  public java.util.List<Role> findAllByRoleScope(String roleScope);

  public java.util.List<Role> findAllByTenantId(String tenantId);

  public java.util.List<Role> findAllByRoleScopeOrTenantId(String roleScope, String tenantId);
}
