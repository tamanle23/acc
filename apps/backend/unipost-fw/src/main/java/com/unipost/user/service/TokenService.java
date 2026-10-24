package com.unipost.user.service;

import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.RequestWrapper;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.domain.AuthenticationToken;
import com.unipost.user.controller.request.AuthenticationRequestBody;

public interface TokenService {

  ResponseWrapper<ContextHeader, AuthenticationToken> getToken(
      RequestWrapper<ContextHeader, AuthenticationRequestBody> request);

  ResponseWrapper<ContextHeader, AuthenticationToken> refreshToken(
      RequestWrapper<ContextHeader, AuthenticationToken> request);

  void logout();
}
