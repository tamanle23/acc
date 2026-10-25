package com.acc.user.controller.mapping;

import java.util.List;

import com.acc.user.controller.request.RoleVm;
import com.acc.user.controller.request.UserVm;
import org.mapstruct.Mapper;

import com.acc.core.io.Page;
import com.acc.user.model.User;
import com.acc.user.repository.mybatis.model.RoleWithUserCount;

@Mapper
public interface UserMapper {

  Page<UserVm> pageToResponsePage(Page<User> page);
//  RoleVm roleToResponseModel(CompositeRole role);
  RoleVm roleToResponseModel(RoleWithUserCount role);
  Page<RoleVm> roleToResponseModel(Page<RoleWithUserCount> roles);
//  List<RoleVm> roleToResponseModel(List<CompositeRole> roles);
  UserVm userToResponseModel(User user);
  List<UserVm> userToResponseModel(List<User> users);
}
