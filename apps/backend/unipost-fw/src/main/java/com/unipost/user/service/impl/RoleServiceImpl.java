package com.unipost.user.service.impl;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import jakarta.transaction.Transactional;

import com.unipost.domain.BaseModel;
import com.unipost.user.controller.mapping.RoleMapper;
import org.apache.commons.collections.CollectionUtils;
import org.apache.commons.lang.BooleanUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.unipost.core.io.Page;
import com.unipost.service.BaseModelService;
import com.unipost.user.dto.CompositeRolePermission;
import com.unipost.user.dto.CompositeUserRole;
import com.unipost.user.controller.request.RoleSearchCondition;
import com.unipost.user.model.Permission;
import com.unipost.user.model.Role;
import com.unipost.user.model.RolePermission;
import com.unipost.user.model.User;
import com.unipost.user.model.UserRole;
import com.unipost.identity.infra.user.repository.jpa.PermissionRepository;
import com.unipost.identity.infra.user.repository.jpa.RolePermissionRepository;
import com.unipost.identity.infra.user.repository.jpa.RoleRepository;
import com.unipost.identity.infra.user.repository.jpa.UserRepository;
import com.unipost.identity.infra.user.repository.jpa.UserRoleRepository;
import com.unipost.user.repository.mybatis.model.RoleWithUserCount;
import com.unipost.user.service.RoleService;

@Transactional
@Service
public class RoleServiceImpl extends BaseModelService<Role, RoleRepository> implements RoleService {

  @Autowired
  RolePermissionRepository rolePermissionRepository;

  @Autowired
  UserRoleRepository accountRoleRepository;

  @Autowired
  PermissionRepository permissionRepository;

  @Autowired
  UserRepository userRepository;

  @Autowired
  com.unipost.user.repository.mybatis.RoleRepository mRoleRepository;

  @Autowired
  RoleMapper roleMapper;

  @Override
  public Page<RoleWithUserCount> findBy(RoleSearchCondition searchRequest) {
    Page<RoleWithUserCount> page = Page.<RoleWithUserCount>builder()
            .totalElements(mRoleRepository.count(searchRequest))
            .content(mRoleRepository.findWithUserCount(searchRequest))
            .build();
    page.setNumber(searchRequest.getPageRequest().getNumber());
    page.setTotalPages((page.getTotalElements() / searchRequest.getPageRequest().getSize()) + 1);
    page.setSize(searchRequest.getPageRequest().getSize());
    return page;
  }

  @Override
  public List<CompositeRolePermission> findAllBelongingPermissions(String uid) {
    return mRoleRepository.findAllRolePermissions(uid);
  }

  @Override
  public List<CompositeUserRole> findAllBelongingUsers(String uid) {
    return mRoleRepository.findAllRoleUsers(uid);
  }

  @Override
  public void updatePermissions(String uid, List<CompositeRolePermission> rolePermissions) {
    Role role = this.repository.findOneByUid(uid);
    List<CompositeRolePermission> newRolePermissions = new ArrayList<>();
    List<CompositeRolePermission> removingRolePermissions = new ArrayList<>();
    for(CompositeRolePermission cRolePermission:rolePermissions){
      if(BooleanUtils.isTrue(cRolePermission.getEnabled())){
        newRolePermissions.add(cRolePermission);
      } else if (cRolePermission.getId() != null) {
        removingRolePermissions.add(cRolePermission);
      }
    }

    if(CollectionUtils.isNotEmpty(removingRolePermissions)) {
      rolePermissionRepository.deleteByIdIn(removingRolePermissions.stream()
                                                                   .map(CompositeRolePermission::getId)
                                                                   .collect(Collectors.toList()));
    }
    if(CollectionUtils.isNotEmpty(newRolePermissions)) {
      Map<Long, Permission> permissionMap = permissionRepository.findAllByIdIn(
                                                                    newRolePermissions.stream().map(entity -> entity.getPermission().getId()).collect(Collectors.toList())
                                                                )
                                                                .stream()
                                                                .collect(Collectors.toMap(Permission::getId, Function.identity()));
      List<RolePermission> permissions = newRolePermissions.stream()
                                                            .map(centity -> RolePermission.builder()
                                                              .permission(permissionMap.get(centity.getPermission().getId()))
                                                              .role(role)
                                                              .build())
                                                            .collect(Collectors.toList());
      rolePermissionRepository.saveAll(permissions);
    }
  }

  @Override
  public void updateUsers(String uid, List<CompositeUserRole> userRoles) {
    Role role = this.repository.findOneByUid(uid);
    List<CompositeUserRole> newUserRoles = new ArrayList<>();
    List<CompositeUserRole> removingUserRoles = new ArrayList<>();
    for(CompositeUserRole cUserRole:userRoles) {
      if(BooleanUtils.isTrue(cUserRole.getEnabled())){
        newUserRoles.add(cUserRole);
      } else {
        if(cUserRole.getUid()!=null) {
          removingUserRoles.add(cUserRole);
        }
      }
    }

    if(CollectionUtils.isNotEmpty(removingUserRoles)) {
      accountRoleRepository.deleteByUidIn(removingUserRoles.stream()
                                                                   .map(CompositeUserRole::getUid)
                                                                   .collect(Collectors.toSet()));
    }
    if(CollectionUtils.isNotEmpty(newUserRoles)) {
      Map<Long,User> accountMap = userRepository.findAllByUidIn(newUserRoles.stream()
                                                                .map(entity->entity.getUser().getUid())
                                                                .collect(Collectors.toSet()))
                                                               .stream()
                                                               .collect(Collectors.toMap(BaseModel::getId,Function.identity()));
      accountRoleRepository.saveAll(
          newUserRoles.stream()
                            .map(centity->UserRole.builder()
                                                        .user(accountMap.get(centity.getUser().getId()))
                                                        .role(role)
                                                        .build())
                            .collect(Collectors.toList()));
    }

  }
}
