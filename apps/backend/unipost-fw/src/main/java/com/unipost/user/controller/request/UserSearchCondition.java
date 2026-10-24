package com.unipost.user.controller.request;

import java.util.List;

import com.unipost.core.io.SearchCondition;
import com.unipost.user.model.enums.UserType;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UserSearchCondition extends SearchCondition {
  private String userName;
  private List<UserType> userTypes;
}
