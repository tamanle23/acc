package com.unipost.user.controller;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.unipost.core.io.ContextHeader;
import com.unipost.core.io.ResponseWrapper;
import com.unipost.domain.AuthenticationToken;
import com.unipost.fw.CommonController;
import com.unipost.fw.controller.validation.Validate;
import com.unipost.user.ValidatorConfiguration;
import com.unipost.user.controller.request.AuthenticationRequestBody;
import com.unipost.user.service.TokenService;

@RestController
@RequestMapping(value="api/auth")
public class AuthenticationController extends CommonController {

  protected ApplicationEventPublisher eventPublisher;

  @Autowired
  TokenService tokenService;

  @Value("${application.security.jwtCookieName}")
  private String jwtCookieName;

  @Value("${application.security.jwtCookieDomain}")
  private String jwtCookieDomain;

  @Value("${application.security.jwtCookieSecure}")
  private String jwtCookieSecure;

  @PostMapping(value = "token")
  public ResponseWrapper<ContextHeader, AuthenticationToken> token(@Validate(name = ValidatorConfiguration.TOKEN_CREATION) @RequestBody AuthenticationRequestBody authenticationRequestBody, HttpServletResponse response) {
    ResponseWrapper<ContextHeader, AuthenticationToken> authenticationTokenResponse = tokenService.getToken(this.extractRequest(authenticationRequestBody));
    AuthenticationToken token = authenticationTokenResponse.getBody();
//    response.addCookie(token.getCookie());
    return authenticationTokenResponse;
  }

  @PostMapping(value = "refresh")
  public ResponseWrapper<ContextHeader, AuthenticationToken> refresh(@Validate(name = ValidatorConfiguration.TOKEN_REFRESH) @RequestBody AuthenticationToken authenticationToken) {
    return tokenService.refreshToken(this.extractRequest(authenticationToken));
  }

  @PatchMapping(value="/logout")
  public ResponseEntity<Object> logout(HttpServletResponse response) {
    tokenService.logout();
    Cookie cookie = new Cookie(jwtCookieName, null);
    cookie.setMaxAge(0);
    response.addCookie(cookie);
    return new ResponseEntity<>(HttpStatus.OK);
  }
}
