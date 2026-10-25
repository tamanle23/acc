package com.unipost.identity.infra.user.repository.jpa;

import com.unipost.repository.jpa.NamedModelBaseRepository;
import com.unipost.user.model.Role;

public interface RoleRepository extends NamedModelBaseRepository<Role> {

  public Role findOneByCodeIgnoreCase(String string);

  public java.util.List<Role> findAllByRoleScope(String roleScope);

  public java.util.List<Role> findAllByTenantId(String tenantId);

  public java.util.List<Role> findAllByRoleScopeOrTenantId(String roleScope, String tenantId);
}
