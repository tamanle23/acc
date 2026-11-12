package com.acc.user.dto;

import com.acc.user.model.RolePermission;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Data
@EqualsAndHashCode(callSuper=true)
@NoArgsConstructor
@AllArgsConstructor
public class CompositeRolePermission extends RolePermission {

  Boolean enabled;
}
