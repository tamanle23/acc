package com.acc.user.service;

import com.acc.core.io.ContextHeader;
import com.acc.core.io.RequestWrapper;
import com.acc.core.io.ResponseWrapper;
import com.acc.domain.AuthenticationToken;
import com.acc.user.controller.request.AuthenticationRequestBody;

public interface TokenService {

  ResponseWrapper<ContextHeader, AuthenticationToken> getToken(
      RequestWrapper<ContextHeader, AuthenticationRequestBody> request);

  ResponseWrapper<ContextHeader, AuthenticationToken> refreshToken(
      RequestWrapper<ContextHeader, AuthenticationToken> request);

  void logout();

  com.acc.system.dto.AuthenticationProfileDto getAuthenticationProfile(com.acc.service.authentication.UserDetailsImpl userDetails);

  com.acc.system.dto.AuthenticationProfileDto getAuthenticationProfile(org.springframework.security.core.Authentication authentication);
}
