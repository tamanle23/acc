package com.acc.user.controller.response;

import com.acc.user.controller.request.PermissionVm;
import com.acc.user.controller.request.UserVm;
import com.acc.user.model.Permission;
import com.acc.user.model.User;
import com.acc.user.model.UserPermission;

import lombok.*;

import java.time.LocalDateTime;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserPermissionVm {

  Long id;
  UserVm user;
  PermissionVm permission;
  Byte status;
  Set<String> inheritingRoles;
  Long version;
  LocalDateTime lastUpdatedDate;
  Boolean enabled;
}
