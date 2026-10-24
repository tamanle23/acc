package com.unipost.user.repository.mybatis.model;

import com.unipost.user.model.Role;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class RoleWithUserCount extends Role {
  Long numberOfUsers;
}
