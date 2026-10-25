package com.acc.user.controller.request;

import java.util.List;

import com.acc.core.io.SearchCondition;
import com.acc.user.model.enums.UserType;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserSearchCondition extends SearchCondition {
  private String userName;
  private List<UserType> userTypes;
}
