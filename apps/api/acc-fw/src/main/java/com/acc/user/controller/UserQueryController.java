package com.acc.user.controller;

import java.util.List;
import java.util.Map;

import com.acc.core.constant.ResourceConstants;
import com.acc.core.io.*;
import com.acc.fw.controller.resolver.JsonParam;
import com.acc.user.controller.request.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CacheConfig;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.security.access.annotation.Secured;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.acc.fw.QueryController;
import com.acc.fw.controller.validation.Validate;
import com.acc.user.ValidatorConfiguration;
import com.acc.user.controller.mapping.UserMapper;
import com.acc.user.model.User;
import com.acc.user.service.UserService;
import com.acc.user.facade.UserFacade;

@RestController
@RequestMapping(value="api/user")
@CacheConfig(cacheNames = {"UserQuery"})
public class UserQueryController extends QueryController<User, UserVm, UserSearchCondition> {

  @Autowired
  UserService<User> userService;

  @Autowired
  UserMapper userMapper;

  @Autowired
  UserFacade userFacade;

  @Override
  public String getResourceName() {
    return ResourceConstants.USER;
  }

  @Override
  public ResponseWrapper<ContextHeader, UserVm> getByUid(@PathVariable String uid) {
    return success(userMapper.userToResponseModel(this.dataService.findByUid(uid)));
  }

  @PostMapping(value="/_names")
  @Cacheable()
  public ResponseWrapper<ContextHeader, Map<String, String>> getUsersName(@RequestBody List<String> userUids) {
    return success(userService.findUsersName(userUids));
  }

  @GetMapping(value="/_list")
  @Override
  public ResponseWrapper<ContextHeader, Page<UserVm>> getSearch(@JsonParam("request") UserSearchCondition searchCondition){
    RequestWrapper<ContextHeader, UserSearchCondition> request = this.extractRequest(searchCondition);
    return success(
        userMapper.pageToResponsePage(userService.findBy(request))
    );
  }

  /**
   * Find users by search condition
   *
   * @param searchCondition the search request
   * @return the response wrapper
   */
  @PostMapping(value="/_list")
  @Override
  public ResponseWrapper<ContextHeader, Page<UserVm>> postSearch(@Validate(name = ValidatorConfiguration.USER_LIST) @RequestBody(required = false) UserSearchCondition searchCondition){
    return success(
        userMapper.pageToResponsePage(userService.findBy(this.extractRequest(searchCondition)))
    );
  }

  @GetMapping(value="{uid}/permissions")
  @Cacheable
  public ResponseWrapper<ContextHeader, Page<PermissionVm>> getUserPermissions(@PathVariable String uid, @RequestBody UserPermissionSearchCondition requestBody){
    return success(
        userService.findUserPermissions(uid, this.extractRequest(requestBody))
    );
  }

  @GetMapping(value="{uid}/roles")
  @Cacheable
  public ResponseWrapper<ContextHeader, Page<RoleVm>> getUserRoles(@PathVariable String uid, @RequestBody UserRoleSearchCondition requestBody){
    return success(
        userService.findUserRoles(uid, this.extractRequest(requestBody))
        );
  }

  @GetMapping(value="{uid}/_with_permissions")
//  @Cacheable
  public ResponseWrapper<ContextHeader, UserVm> getUserWithPermissions(@PathVariable String uid, PageRequest pageRequest){
    return success(userFacade.findUserWithPermissions(uid));
  }
}
