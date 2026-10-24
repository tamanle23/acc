package com.unipost.user.controller.request;

import com.unipost.user.controller.response.UserPermissionVm;
import com.unipost.user.model.User;
import com.unipost.user.model.enums.UserStatus;
import com.unipost.user.model.enums.UserType;
import lombok.*;

import java.util.List;

@NoArgsConstructor
@AllArgsConstructor
@Builder
@Getter
@Setter
public class UserVm {
  private Long id;
  private String uid;
  private String userName;
  private String email;
  private String firstName;
  private String lastName;
  private boolean nonExpired;
  private boolean nonLocked;
  private boolean credentialsNonExpired;
  private UserStatus status;
  private UserType type;

  List<UserPermissionVm> userPermissions;
  List<UserRoleVm> userRoles;
}
