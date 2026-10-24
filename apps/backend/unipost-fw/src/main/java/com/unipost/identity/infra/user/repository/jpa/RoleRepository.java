package com.unipost.identity.infra.user.repository.jpa;

import com.unipost.repository.jpa.NamedModelBaseRepository;
import com.unipost.user.model.Role;

public interface RoleRepository extends NamedModelBaseRepository<Role> {

  public Role findOneByCodeIgnoreCase(String string);

}
