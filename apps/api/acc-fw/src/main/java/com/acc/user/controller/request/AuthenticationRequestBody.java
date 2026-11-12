package com.acc.user.controller.request;

import com.acc.user.model.enums.ClientType;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuthenticationRequestBody {

  @com.fasterxml.jackson.annotation.JsonAlias({"username", "user_name"})
  String userName;
  String password;
  ClientType clientType;
}
