package com.acc.identity.infra.user.repository.jpa;

import java.util.List;

import com.acc.repository.jpa.BaseRepository;
import com.acc.user.model.User;
import com.acc.user.model.UserRole;

public interface UserRoleRepository extends BaseRepository<UserRole>{

  List<UserRole> findAllByUser(User userUser);

  List<UserRole> findAllByUserAndTenantId(User user, String tenantId);

  List<UserRole> findAllByTenantId(String tenantId);

  void deleteAllByUserAndTenantId(User user, String tenantId);
}
