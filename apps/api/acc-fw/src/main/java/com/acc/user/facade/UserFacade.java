package com.acc.user.facade;

import com.acc.user.controller.request.UserVm;

@Deprecated
public interface UserFacade {
  UserVm findUserWithPermissions(String uid);
}
