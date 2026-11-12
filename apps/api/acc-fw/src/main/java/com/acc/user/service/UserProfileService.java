package com.acc.user.service;

import com.acc.system.dto.UserProfileDto;
import com.acc.system.dto.UpdateUserProfileRequest;

public interface UserProfileService {

    UserProfileDto getUserProfile(String username);

    UserProfileDto updateUserProfile(String username, UpdateUserProfileRequest request);
}
