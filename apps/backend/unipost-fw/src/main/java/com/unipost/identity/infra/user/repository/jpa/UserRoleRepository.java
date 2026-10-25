package com.unipost.identity.infra.user.repository.jpa;

import java.util.List;

import com.unipost.repository.jpa.BaseRepository;
import com.unipost.user.model.User;
import com.unipost.user.model.UserRole;

public interface UserRoleRepository extends BaseRepository<UserRole>{

  List<UserRole> findAllByUser(User userUser);

  List<UserRole> findAllByUserAndTenantId(User user, String tenantId);

  List<UserRole> findAllByTenantId(String tenantId);

  void deleteAllByUserAndTenantId(User user, String tenantId);
}
