package com.unipost.user.controller.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.unipost.user.model.enums.UserStatus;
import com.unipost.user.model.enums.UserType;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UserResponseModel {
  private String uid;
  private String userName;
  private String email;
  private String firstName;
  private String lastName;
  private boolean nonExpired;
  private boolean nonLocked;
  private boolean credentialsNonExpired;
  private UserStatus status;
  private UserType type;
}
