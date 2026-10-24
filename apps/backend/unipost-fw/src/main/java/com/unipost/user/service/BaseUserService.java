package com.unipost.user.service;

import com.unipost.service.BaseModelService;
import com.unipost.user.model.User;
import com.unipost.identity.infra.user.repository.jpa.UserRepository;

public abstract class BaseUserService extends BaseModelService<User, UserRepository> implements UserService<User> {



  public BaseUserService() {
    entityClass = User.class;
  }


}
