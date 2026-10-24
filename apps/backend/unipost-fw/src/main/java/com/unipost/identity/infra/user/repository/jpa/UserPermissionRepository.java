package com.unipost.identity.infra.user.repository.jpa;

import java.util.List;

import com.unipost.repository.jpa.BaseRepository;
import com.unipost.user.model.User;
import com.unipost.user.model.UserPermission;

public interface UserPermissionRepository extends BaseRepository<UserPermission>{

  List<UserPermission> findAllByUser(User user);
}
