package com.acc.user.service;

import java.util.Optional;

import com.acc.core.exception.ErrorCodes;
import com.acc.core.io.ContextHeader;
import org.slf4j.Logger;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.acc.core.context.Context;
import com.acc.core.exception.BusinessException;
import com.acc.core.helper.GenerationHelper;
import com.acc.core.io.CommonReponseBuilder;
import com.acc.core.io.RequestWrapper;
import com.acc.core.io.ResponseWrapper;
import com.acc.core.logging.LoggerFactory;
import com.acc.domain.AuthenticationToken;
import com.acc.fw.core.jwt.JwtTokenHelper;
import com.acc.service.authentication.UserDetailsImpl;
import com.acc.user.controller.request.AuthenticationRequestBody;
import com.acc.user.model.User;

import org.apache.commons.lang3.StringUtils;
import io.jsonwebtoken.Claims;

@Service
@Transactional
public class TokenServiceImpl extends CommonReponseBuilder implements TokenService {

  Logger logger = LoggerFactory.getLogger(this.getClass());

  @Autowired
  UserService<User> userService;

  @Autowired
  private AuthenticationManager authenticationManager;

  @Autowired
  JwtTokenHelper jwtHelper;

  @Autowired
  Context context;

  @Autowired
  protected GenerationHelper generationHelper;

  @Autowired
  UserDetailsService userDetailsService;

  @Override
  protected Context getContext() {
    return context;
  }

  public ResponseWrapper<ContextHeader, AuthenticationToken> getToken(RequestWrapper<ContextHeader,AuthenticationRequestBody> request) {
    this.authenticate(request.getBody().getUserName(), request.getBody().getPassword());
    final UserDetails userDetails = userDetailsService.loadUserByUsername(request.getBody().getUserName());
    return success(jwtHelper.generateToken(userDetails, request.getHeader().getClientType()));
  }

  public ResponseWrapper<ContextHeader, AuthenticationToken> refreshToken(RequestWrapper<ContextHeader, AuthenticationToken> request) {
    String refreshTokenStr = request.getBody() != null ? request.getBody().getRefreshToken() : null;
    if (StringUtils.isBlank(refreshTokenStr) && request.getBody() != null) {
      refreshTokenStr = request.getBody().getAccessToken();
    }
    if (StringUtils.isNotBlank(refreshTokenStr)) {
      Optional<Claims> claimsOpt = jwtHelper.getClaims(refreshTokenStr);
      if (claimsOpt.isPresent()) {
        Claims claims = claimsOpt.get();
        String username = claims.getSubject();
        String clientType = request.getHeader() != null ? request.getHeader().getClientType() : null;
        if (StringUtils.isNotBlank(username) && jwtHelper.validate(claims, clientType)) {
          final UserDetails userDetails = userDetailsService.loadUserByUsername(username);
          return success(jwtHelper.generateToken(userDetails, clientType));
        }
      }
    }
    throw BusinessException.create().add(ErrorCodes.ERROR).setHttpCode(HttpStatus.UNAUTHORIZED.value());
  }

  private void authenticate(String username, String password) {
    try {
      authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
    } catch (DisabledException e) {
      logger.error("ERROR occured: ", e);
      throw BusinessException.create().add(ErrorCodes.ERROR_USER_DISABLED);
    } catch (BadCredentialsException e) {
      logger.error("ERROR occured: ", e);
      throw BusinessException.create().add(ErrorCodes.ERROR_LOGIN_INVALID_CREDENTIALS);
    }
  }

  @Override
  public void logout() {
  }
}
