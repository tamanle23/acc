package com.acc.user.facade;

import com.acc.user.controller.mapping.RoleMapper;
import com.acc.user.controller.request.RoleVm;
import com.acc.user.controller.request.RolePermissionVm;
import com.acc.user.controller.request.UserRoleVm;
import com.acc.user.dto.CompositeRolePermission;
import com.acc.user.dto.CompositeUserRole;
import com.acc.user.controller.request.PermissionVm;
import com.acc.user.controller.request.UserVm;
import com.acc.user.model.Role;
import com.acc.user.model.Permission;
import com.acc.user.model.User;
import com.acc.user.service.RoleService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class RoleFacadeImpl implements RoleFacade {

  @Autowired
  private RoleService roleService;

  @Autowired
  private RoleMapper roleMapper;

  @Override
  public RoleVm getRoleDetail(String uid) {
    Role role = roleService.findByUid(uid);
    RoleVm roleVm = roleMapper.roleToResponseModel(role);

    roleVm.setRolePermissions(findAllBelongingPermissions(uid));
    roleVm.setRoleUsers(findAllBelongingUsers(uid));

    return roleVm;
  }

  @Override
  public List<RolePermissionVm> findAllBelongingPermissions(String uid) {
    List<CompositeRolePermission> permissions = roleService.findAllBelongingPermissions(uid);
    return permissions.stream().map(p -> {
        RolePermissionVm vm = new RolePermissionVm();
        vm.setId(p.getId());
        vm.setEnabled(p.getEnabled());
        if (p.getPermission() != null) {
            Permission perm = p.getPermission();
            PermissionVm pVm = new PermissionVm();
            pVm.setId(perm.getId());
            pVm.setUid(perm.getUid());
            pVm.setCode(perm.getCode());
            pVm.setDescription(perm.getDescription());
            pVm.setVersion(perm.getVersion());
            pVm.setType(perm.getType());
            pVm.setLastUpdatedDate(perm.getLastUpdatedDate());
            vm.setPermission(pVm);
        }
        return vm;
    }).collect(Collectors.toList());
  }

  @Override
  public List<UserRoleVm> findAllBelongingUsers(String uid) {
    List<CompositeUserRole> users = roleService.findAllBelongingUsers(uid);
    return users.stream().map(u -> {
        UserRoleVm vm = new UserRoleVm();
        vm.setId(u.getId());
        vm.setVersion(u.getVersion());
        vm.setEnabled(u.getEnabled());
        if (u.getUser() != null) {
            User user = u.getUser();
            UserVm uVm = new UserVm();
            uVm.setId(user.getId());
            uVm.setUid(user.getUid());
            uVm.setUserName(user.getUserName());
            vm.setUser(uVm);
        }
        return vm;
    }).collect(Collectors.toList());
  }

  @Override
  public void updatePermissions(String uid, List<RolePermissionVm> rolePermissions) {
    List<CompositeRolePermission> dtos = rolePermissions.stream().map(vm -> {
        CompositeRolePermission dto = new CompositeRolePermission();
        dto.setId(vm.getId());
        dto.setEnabled(vm.getEnabled());
        return dto;
    }).collect(Collectors.toList());
    roleService.updatePermissions(uid, dtos);
  }

  @Override
  public void updateUsers(String uid, List<UserRoleVm> userRoles) {
    List<CompositeUserRole> dtos = userRoles.stream().map(vm -> {
        CompositeUserRole dto = new CompositeUserRole();
        dto.setId(vm.getId());
        dto.setUid(vm.getUid());
        dto.setEnabled(vm.getEnabled());
        dto.setVersion(vm.getVersion());
        return dto;
    }).collect(Collectors.toList());
    roleService.updateUsers(uid, dtos);
  }
}
