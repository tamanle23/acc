package com.unipost.user.controller.mapping;

import com.unipost.user.controller.request.RoleVm;
import com.unipost.user.model.Role;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper
public interface RoleMapper {

  RoleVm roleToResponseModel(Role role);
//  List<RoleVm> roleToResponseModel(List<Role> roles);
}
