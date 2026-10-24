package com.unipost.user.service.impl;

import com.unipost.core.exception.ErrorCodes;
import com.unipost.domain.NamedModel;
import com.unipost.service.authentication.UserDetailsImpl;
import com.unipost.user.model.UserPermission;
import com.unipost.user.model.UserRole;
import com.unipost.user.model.enums.UserStatus;
import com.unipost.identity.infra.user.repository.jpa.UserPermissionRepository;
import com.unipost.identity.infra.user.repository.jpa.UserRoleRepository;
import jakarta.inject.Inject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import com.unipost.user.model.User;
import com.unipost.user.service.UserService;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class UserDetailsServiceImpl implements UserDetailsService {

  Logger logger = LoggerFactory.getLogger(UserDetailsServiceImpl.class);

  @Inject
  protected com.unipost.identity.infra.user.repository.jpa.UserRepository userRepository;

  @Autowired
  UserPermissionRepository userPermissionRepository;

  @Autowired
  UserRoleRepository userRoleRepository;

  @Override
  public UserDetails loadUserByUsername(String username) {
    return loadUserByUserName(username);
  }


  public UserDetailsImpl loadUserByUserName(String username) {
    User user = userRepository.findByUserName(username);
    return loadUser(user);
  }

  public UserDetailsImpl loadUserById(Long id) {
    User userUser = userRepository.findOne(id);
    return loadUser(userUser);
  }

  private UserDetailsImpl loadUser(User userUser) {
    List<GrantedAuthority> authorities = new ArrayList<>();
    UserDetailsImpl userDetails;
    if (userUser == null) {
      throw new UsernameNotFoundException(ErrorCodes.ERROR_LOGIN_INVALID_CREDENTIALS.getMessage());
    }
    Set<String> permissions = this.userPermissionRepository.findAllByUser(userUser)
      .stream()
      .map(UserPermission::getPermission)
      .map(NamedModel::getCode)
      .collect(Collectors.toSet());
    List<UserRole> userRoles = this.userRoleRepository.findAllByUser(userUser);
    if (userRoles != null) {
      for (UserRole userRole : userRoles) {
        authorities.add(new SimpleGrantedAuthority("ROLE_" + userRole.getRole().getCode().toUpperCase()));
        permissions.addAll(userRole.getRole().getPermissions().stream().map(NamedModel::getCode).collect(Collectors.toList()));
      }
    }
    if (permissions != null) {
      for (String permission : permissions) {
        GrantedAuthority authority = new SimpleGrantedAuthority(permission.toUpperCase());
        authorities.add(authority);
      }
    }
    Map<String, Object> userMap = new HashMap<>();
    userMap.put("uid", userUser.getUid());
    userMap.put("userName", userUser.getUserName());
    userMap.put("password", userUser.getPassword());
    userMap.put("isNonLocked", userUser.isNonLocked());
    userMap.put("isNonExpired", userUser.isNonExpired());
    userMap.put("isCredentialsNonExpired", userUser.isCredentialsNonExpired());
    userMap.put("isEnabled", userUser.getStatus() == UserStatus.ENABLED);
    userMap.put("userType", userUser.getType().toString());
    userDetails = new UserDetailsImpl(userMap, authorities);

    return userDetails;
  }

}
