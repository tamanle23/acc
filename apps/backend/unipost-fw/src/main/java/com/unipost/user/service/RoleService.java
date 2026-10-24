package com.unipost.user.service;

import java.util.List;

import com.unipost.core.io.Page;
import com.unipost.service.CrudService;
import com.unipost.user.dto.CompositeRolePermission;
import com.unipost.user.dto.CompositeUserRole;
import com.unipost.user.controller.request.RoleSearchCondition;
import com.unipost.user.model.Role;
import com.unipost.user.repository.mybatis.model.RoleWithUserCount;

public interface RoleService extends CrudService<Role>{

  Page<RoleWithUserCount> findBy(RoleSearchCondition searchRequestBody);

  List<CompositeRolePermission> findAllBelongingPermissions(String uid);

  void updatePermissions(String uid, List<CompositeRolePermission> rolePermissions);

  void updateUsers(String uid, List<CompositeUserRole> userRoles);

  List<CompositeUserRole> findAllBelongingUsers(String uid);
}
