package com.unipost.user.controller;

import java.util.List;

import com.unipost.core.constant.ResourceConstants;
import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.CommandController;
import com.unipost.user.controller.request.RolePermissionVm;
import com.unipost.user.controller.request.RoleVm;
import com.unipost.user.controller.request.UserRoleVm;
import com.unipost.user.model.Role;
import com.unipost.user.service.RoleService;
import com.unipost.user.facade.RoleFacade;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(value="api/role")
public class RoleCommandController extends CommandController<Role, RoleVm> {

  @Autowired
  RoleService roleService;

  @Autowired
  RoleFacade roleFacade;

  @Override
  public String getResourceName() {
    return ResourceConstants.ROLE;
  }

  @PostMapping(value="{uid}/permissions")
  public ResponseWrapper<ContextHeader, Void> updateRolePermissions(@PathVariable String uid, @RequestBody List<RolePermissionVm> rolePermissions){
    roleFacade.updatePermissions(uid, rolePermissions);
    return ResponseWrapper.success(null);
  }

  @PostMapping(value="{uid}/users")
  public ResponseWrapper<ContextHeader, Void> updateUserRoles(@PathVariable String uid, @RequestBody List<UserRoleVm> userRoles) {
    roleFacade.updateUsers(uid, userRoles);
    return ResponseWrapper.success(null);
  }

  @Override
  public ResponseWrapper<ContextHeader, RoleVm> create(RoleVm RoleVm) {
    return null;
  }

  @Override
  public ResponseWrapper<ContextHeader, RoleVm> update(Long id, RoleVm RoleVm) {
    return null;
  }
}
