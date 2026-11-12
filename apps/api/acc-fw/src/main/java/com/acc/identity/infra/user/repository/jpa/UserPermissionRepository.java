package com.acc.identity.infra.user.repository.jpa;

import java.util.List;

import com.acc.repository.jpa.BaseRepository;
import com.acc.user.model.User;
import com.acc.user.model.UserPermission;

public interface UserPermissionRepository extends BaseRepository<UserPermission>{

  List<UserPermission> findAllByUser(User user);

  List<UserPermission> findAllByUserAndTenantId(User user, String tenantId);

  List<UserPermission> findAllByTenantId(String tenantId);

  void deleteAllByUserAndTenantId(User user, String tenantId);
}
