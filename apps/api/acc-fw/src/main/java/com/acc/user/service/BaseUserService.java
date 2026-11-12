package com.acc.user.service;

import com.acc.service.BaseModelService;
import com.acc.user.model.User;
import com.acc.identity.infra.user.repository.jpa.UserRepository;

public abstract class BaseUserService extends BaseModelService<User, UserRepository> implements UserService<User> {



  public BaseUserService() {
    entityClass = User.class;
  }


}
