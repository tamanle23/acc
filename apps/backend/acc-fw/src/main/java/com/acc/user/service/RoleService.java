package com.acc.user.service;

import java.util.List;

import com.acc.core.io.Page;
import com.acc.service.CrudService;
import com.acc.user.dto.CompositeRolePermission;
import com.acc.user.dto.CompositeUserRole;
import com.acc.user.controller.request.RoleSearchCondition;
import com.acc.user.model.Role;
import com.acc.user.repository.mybatis.model.RoleWithUserCount;

public interface RoleService extends CrudService<Role>{

  Page<RoleWithUserCount> findBy(RoleSearchCondition searchRequestBody);

  List<CompositeRolePermission> findAllBelongingPermissions(String uid);

  void updatePermissions(String uid, List<CompositeRolePermission> rolePermissions);

  void updateUsers(String uid, List<CompositeUserRole> userRoles);

  List<CompositeUserRole> findAllBelongingUsers(String uid);
}
