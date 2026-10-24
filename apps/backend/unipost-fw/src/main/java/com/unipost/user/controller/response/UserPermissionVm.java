package com.unipost.user.controller.response;

import com.unipost.user.controller.request.PermissionVm;
import com.unipost.user.controller.request.UserVm;
import com.unipost.user.model.Permission;
import com.unipost.user.model.User;
import com.unipost.user.model.UserPermission;

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
