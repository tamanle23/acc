package com.unipost.user.facade;

import com.unipost.core.exception.BusinessException;
import com.unipost.core.exception.ErrorCodes;
import com.unipost.user.controller.mapping.UserMapper;
import com.unipost.user.controller.request.UserVm;
import com.unipost.user.controller.response.UserPermissionVm;
import com.unipost.user.controller.request.UserRoleVm;
import com.unipost.user.dto.CompositeUserPermission;
import com.unipost.user.dto.CompositeUserRole;
import com.unipost.user.controller.request.PermissionVm;
import com.unipost.user.controller.request.RoleVm;
import com.unipost.user.model.User;
import com.unipost.user.service.UserService;
import org.apache.commons.collections.CollectionUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class UserFacadeImpl implements UserFacade {

  @Autowired
  private UserService<User> userService;

  @Autowired
  private UserMapper userMapper;

  @Override
  public UserVm findUserWithPermissions(String uid) {
    User user = this.userService.findByUid(uid);

    if (user == null) {
      throw BusinessException.create().add(ErrorCodes.ERROR_NOT_EXISTED);
    }

    UserVm qUser = this.userMapper.userToResponseModel(user);

    List<CompositeUserPermission> permissions = userService.findAllUserPermissions(uid);
    List<CompositeUserRole> roles = userService.findAllUserRoles(uid);

    List<UserPermissionVm> permissionVms = permissions.stream().map(p -> {
        UserPermissionVm vm = new UserPermissionVm();
        vm.setId(p.getId());
        vm.setVersion(p.getVersion());
        vm.setStatus(p.getStatus());
        vm.setLastUpdatedDate(p.getLastUpdatedDate());
        if (p.getPermission() != null) {
            PermissionVm pVm = new PermissionVm();
            pVm.setId(p.getPermission().getId());
            pVm.setUid(p.getPermission().getUid());
            pVm.setCode(p.getPermission().getCode());
            pVm.setDescription(p.getPermission().getDescription());
            pVm.setVersion(p.getPermission().getVersion());
            pVm.setType(p.getPermission().getType());
            pVm.setLastUpdatedDate(p.getPermission().getLastUpdatedDate());
            vm.setPermission(pVm);
        }
        return vm;
    }).collect(Collectors.toList());

    List<UserRoleVm> roleVms = roles.stream().map(r -> {
        UserRoleVm vm = new UserRoleVm();
        vm.setId(r.getId());
        vm.setVersion(r.getVersion());
        vm.setEnabled(r.getEnabled());
        if (r.getRole() != null) {
            RoleVm rVm = new RoleVm();
            rVm.setId(r.getRole().getId());
            rVm.setUid(r.getRole().getUid());
            rVm.setCode(r.getRole().getCode());
            rVm.setDescription(r.getRole().getDescription());
            rVm.setVersion(r.getRole().getVersion());
            vm.setRole(rVm);
        }
        return vm;
    }).collect(Collectors.toList());

    qUser.setUserPermissions(permissionVms);
    qUser.setUserRoles(roleVms);

    if (CollectionUtils.isNotEmpty(qUser.getUserRoles())
        && CollectionUtils.isNotEmpty(qUser.getUserPermissions())) {
      Set<Long> roleIds = qUser.getUserRoles()
          .stream()
          .filter(UserRoleVm::getEnabled)
          .map(ar -> ar.getRole().getId())
          .collect(Collectors.toSet());

      Map<String, Set<String>> roleGroupByPermission = CollectionUtils.isEmpty(roleIds) ? Collections.emptyMap() :
          userService.findAllRoleGroupByPermission(roleIds);

      qUser.getUserPermissions()
          .stream()
          .forEach(ap -> {
              if (ap.getPermission() != null) {
                  ap.setInheritingRoles(roleGroupByPermission.get(ap.getPermission().getUid()));
              }
          });
    }
    return qUser;
  }
}
