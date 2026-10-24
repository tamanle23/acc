package com.unipost.identity.infra.user.repository.jpa;

import java.util.List;

import com.unipost.repository.jpa.BaseRepository;
import com.unipost.user.model.User;
import com.unipost.user.model.UserRole;

public interface UserRoleRepository extends BaseRepository<UserRole>{

  List<UserRole> findAllByUser(User userUser);
}
