package com.unipost.user.controller.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserRegistrationRequestBody {
  private String firstName;
  private String lastName;
  private String password;
  private String matchingPassword;
  private String email;
  private String userName;
  private String mobileNo;
  private boolean isUsing2FA;
}
