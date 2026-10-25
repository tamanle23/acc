package com.acc.user.controller.mapping;

import com.acc.user.controller.request.RoleVm;
import com.acc.user.model.Role;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper
public interface RoleMapper {

  RoleVm roleToResponseModel(Role role);
//  List<RoleVm> roleToResponseModel(List<Role> roles);
}
