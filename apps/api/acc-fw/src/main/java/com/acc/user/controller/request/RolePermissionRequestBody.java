package com.acc.user.controller.request;

import java.util.List;

import com.acc.user.dto.CompositeRolePermission;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
public class RolePermissionRequestBody {
  Long roleId;
  List<CompositeRolePermission> rolePermissions;
}
