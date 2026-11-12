package com.acc.identity.infra.user.repository.jpa;

import com.acc.repository.jpa.NamedModelBaseRepository;
import com.acc.user.model.Permission;

public interface PermissionRepository extends NamedModelBaseRepository<Permission> {
  Permission findOneByCodeIgnoreCase(String code);
}
