package com.acc.fw.authentication;

import jakarta.inject.Inject;

import com.acc.service.user.LoginAttemptService;
import org.springframework.context.ApplicationListener;
import org.springframework.security.authentication.event.AuthenticationFailureBadCredentialsEvent;
import org.springframework.stereotype.Component;

@Component
public class AuthenticationFailureListener implements ApplicationListener<AuthenticationFailureBadCredentialsEvent> {

  @Inject
  private LoginAttemptService loginAttemptService;

  public void onApplicationEvent(AuthenticationFailureBadCredentialsEvent e) {
//    WebAuthenticationDetails auth = (WebAuthenticationDetails) e.getAuthentication().getDetails();
//    loginAttemptService.loginFailed(auth.getRemoteAddress(), auth.getSessionId());
  }
}
