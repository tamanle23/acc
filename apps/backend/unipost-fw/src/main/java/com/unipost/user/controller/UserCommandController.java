package com.unipost.user.controller;

import java.util.List;

import jakarta.inject.Inject;

import com.unipost.core.constant.ResourceConstants;
import com.unipost.core.io.ContextHeader;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.access.annotation.Secured;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.unipost.core.io.ResponseWrapper;
import com.unipost.fw.CommandController;
import com.unipost.service.authentication.UserDetailsImpl;
import com.unipost.core.constant.RoleConstants;
import com.unipost.user.controller.response.UserPermissionVm;
import com.unipost.user.model.User;
import com.unipost.user.service.UserService;

@RestController
@RequestMapping(value="api/user")
public class UserCommandController extends CommandController<User, User> {

  @Autowired
  private ApplicationEventPublisher eventPublisher;

  @Inject
  UserService<User> userService;

  @Override
  public String getResourceName() {
    return ResourceConstants.USER;
  }

//  @RequestMapping(value = "/register", method = RequestMethod.POST)
//  @ResponseBody
//  public ResponseWrapper<?> registerUserAccount(@RequestBody UserRegistrationRequestBody userRegistrationRequestBody) {
//    logger.debug("Registering user account with information: {}", userVM);
//    User user = User.builder()
//                    .firstName(userVM.getFirstName())
//                    .lastName(userVM.getLastName())
//                    .password(userVM.getPassword())
//                    .email(userVM.getEmail())
//                    .isUsing2FA(userVM.isUsing2FA())
//                    .build();
//
//    user = this.dataService.create(user);
//    eventPublisher.publishEvent(new OnRegistrationCompleteEvent(user, request.getLocale(), getAppUrl(request)));
//    return success(user);
//  }
//
//  @RequestMapping(value = "/register/_captcha", method = RequestMethod.POST)
//  @ResponseBody
//  public ResponseWrapper<?> captchaRegisterUserAccount(@Valid final UserVM userVM, final HttpServletRequest request) {
//
//    final String response = request.getParameter("g-recaptcha-response");
//    captchaService.processResponse(response);
//
//    logger.debug("Registering user account with information: {}", userVM);
//    User user = User.builder()
//                    .firstName(userVM.getFirstName())
//                    .lastName(userVM.getLastName())
//                    .password(userVM.getPassword())
//                    .email(userVM.getEmail())
//                    .isUsing2FA(userVM.isUsing2FA())
//                    .build();
//    final User registered = userService.registerNewUser(user);
//    eventPublisher.publishEvent(new OnRegistrationCompleteEvent(registered, request.getLocale(), getAppUrl(request)));
//    return success(user);
//  }

  @PatchMapping(value="/change-status/{userName}/{isEnabled}")
  @Secured(value = {RoleConstants.ADMINSTRATION})
  public ResponseWrapper<ContextHeader, Void> changeUserStatus(@PathVariable("userName") String userName, @PathVariable("isEnabled") Boolean isEnabled, @AuthenticationPrincipal UserDetailsImpl userDetails) {
    userService.disableUser(userDetails.getUsername());
    return ResponseWrapper.success();
  }

  @PatchMapping(value="/disable")
  @Secured(value = {RoleConstants.ADMINSTRATION})
  public ResponseWrapper<ContextHeader, Void> disableUser(@AuthenticationPrincipal UserDetailsImpl userDetails) {
    userService.disableUser(userDetails.getUsername());
    return ResponseWrapper.success();
  }

  @PostMapping(value="{uid}/permissions")
  public ResponseWrapper<ContextHeader, Void> updateRolePermissions(@PathVariable String uid, @RequestBody List<UserPermissionVm> userPermissions){
    userService.updatePermissions(uid, userPermissions);
    return ResponseWrapper.success(null);
  }

  @Override
  public ResponseWrapper<ContextHeader, User> create(User entity) {
    return null;
  }

  @Override
  public ResponseWrapper<ContextHeader, User> update(@PathVariable Long id,@RequestBody User user) {
    User updatedUser = this.dataService.modify(id, (existingUser) -> {
      existingUser.setStatus(user.getStatus());
      existingUser.setUserName(user.getUserName());
      existingUser.setEmail(user.getEmail());
    });
    return success(updatedUser);
  }
}
