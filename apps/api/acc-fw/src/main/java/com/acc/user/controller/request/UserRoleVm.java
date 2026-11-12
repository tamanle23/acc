package com.acc.user.controller.request;

import com.acc.user.model.UserRole;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UserRoleVm {

  Long id;
  String uid;
  UserVm user;
  RoleVm role;
  Boolean enabled;
  Long version;
}
