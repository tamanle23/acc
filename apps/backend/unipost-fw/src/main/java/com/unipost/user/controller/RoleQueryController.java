package com.unipost.user.controller;

import java.util.List;

import com.unipost.core.constant.ResourceConstants;
import com.unipost.core.io.ContextHeader;
import com.unipost.user.controller.request.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.unipost.core.io.Page;
import com.unipost.core.io.PageRequest;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.QueryController;
import com.unipost.user.controller.mapping.UserMapper;
import com.unipost.user.model.Role;
import com.unipost.user.service.RoleService;
import com.unipost.user.facade.RoleFacade;

@RestController
@RequestMapping(value="api/role")
@CacheConfig(cacheNames = "RoleQuery")
public class RoleQueryController extends QueryController<Role, RoleVm, RoleSearchCondition> {

  @Autowired
  RoleService roleService;

  @Autowired
  UserMapper userMapper;

  @Autowired
  RoleFacade roleFacade;

  @Override
  public String getResourceName() {
    return ResourceConstants.ROLE;
  }

  @GetMapping(value="/_list")
  public ResponseWrapper<ContextHeader, Page<RoleVm>> getSearch(RoleSearchCondition searchCondition){
    return success(
      userMapper.roleToResponseModel(roleService.findBy(searchCondition))
    );
  }

  @PostMapping(value="/_list")
  public ResponseWrapper<ContextHeader, Page<RoleVm>> postSearch(@RequestBody(required = false) RoleSearchCondition searchRequest){
    return success(
      userMapper.roleToResponseModel(roleService.findBy(searchRequest))
    );
  }

  @GetMapping(value="{uid}/permissions")
  public ResponseWrapper<ContextHeader, List<RolePermissionVm>> getAllRolePermissions(@PathVariable String uid, PageRequest pageRequest){
    return success(roleFacade.findAllBelongingPermissions(uid));
  }

  @GetMapping(value="{uid}/users")
  public ResponseWrapper<ContextHeader, List<UserRoleVm>> getBelongingUsers(@PathVariable String uid, PageRequest pageRequest){
    return success(roleFacade.findAllBelongingUsers(uid));
  }

  @GetMapping(value="{uid}/_with_permissions")
  public ResponseWrapper<ContextHeader, RoleVm> getRoleDetail(@PathVariable String uid, PageRequest pageRequest){
    return success(roleFacade.getRoleDetail(uid));
  }
}
