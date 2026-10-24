package com.unipost.user.facade;

import com.unipost.user.controller.request.UserVm;

@Deprecated
public interface UserFacade {
  UserVm findUserWithPermissions(String uid);
}
