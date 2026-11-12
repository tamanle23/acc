package com.acc.user.service;

import java.util.List;
import java.util.Map;

import com.acc.core.io.ContextHeader;
import com.acc.core.io.Page;
import com.acc.core.io.RequestWrapper;
import com.acc.user.controller.request.*;
import com.acc.user.controller.response.UserPermissionVm;
import com.acc.user.dto.CompositeUserPermission;
import com.acc.user.dto.CompositeUserRole;
import com.acc.user.model.enums.UserStatus;
import com.acc.user.model.enums.UserType;
import com.acc.service.CrudService;

import java.util.Set;
import com.acc.user.model.AuthenticationType;
import com.acc.user.model.PasswordResetToken;
import com.acc.user.model.RegistrationToken;
import com.acc.user.model.User;

@Deprecated
public interface UserService<T extends User> extends CrudService<T>{

  public T findByIdAndUserType(Long accountId, UserType accountType);
  public T findByUserName(String userName);
  public void approveUser(T account,UserStatus status);
  public void registerAuthenticationActivity(T account, AuthenticationType loginsuccess,String userAgent);
  public void enableUser(String userName);
  public void disableUser(String userName);
  public List<CompositeUserPermission> findAllUserPermissions(String uid);
  public List<CompositeUserRole> findAllUserRoles(String uid);
  public Map<String, Set<String>> findAllRoleGroupByPermission(Set<Long> roleIds);
//  public Page<T> findAllByCriteria(Specification<T> criteria, Pageable pageable);
//  public Page<T> findAll(Pageable pageable);
//  public Page<T> findAll(PageRequest pageable);
  public List<T> findAll();
  public Page<User> findBy(RequestWrapper<ContextHeader, UserSearchCondition> request);

  public User getUserByRegistrationToken(String registrationToken);
  public void createRegistrationToken(User user, String token);
  public RegistrationToken getRegistrationToken(String registrationToken);
  public RegistrationToken generateRegistrationToken(String token);
  public void createPasswordResetToken(User user, String token);
  public PasswordResetToken getPasswordResetToken(String token);
  public User getUserByPasswordResetToken(String token);
  public void changeUserPassword(User user, String password);
  public boolean checkIfValidOldPassword(User user, String password);
  public String validateVerificationToken(String token);
  public String generateQRUrl(User user);
  public boolean validatePasswordResetToken(long id, String token);
  public void resetPassword(String newPassword, long id, String token);
  public Map<String, String> findUsersName(List<String> userUids);
  public Object getUserProfile(String uid);
  public Page<RoleVm> findUserRoles(String uid, RequestWrapper<ContextHeader, UserRoleSearchCondition> request);
  public void updatePermissions(String uid, List<UserPermissionVm> userPermissions);
  public Page<PermissionVm> findUserPermissions(String uid, RequestWrapper<ContextHeader, UserPermissionSearchCondition> request);

}
