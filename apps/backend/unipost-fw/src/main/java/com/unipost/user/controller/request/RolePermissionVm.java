package com.unipost.user.controller.request;

import com.unipost.user.model.RolePermission;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RolePermissionVm {

  Long id;
  String uid;
  RoleVm role;
  PermissionVm permission;
  Boolean enabled;
}
