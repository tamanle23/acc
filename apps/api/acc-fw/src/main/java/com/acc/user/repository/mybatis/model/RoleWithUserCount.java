package com.acc.user.repository.mybatis.model;

import com.acc.user.model.Role;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoleWithUserCount extends Role {
  Long numberOfUsers;
}
