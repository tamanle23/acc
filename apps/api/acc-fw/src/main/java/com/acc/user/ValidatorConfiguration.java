package com.acc.user;

import br.com.fluentvalidator.Validator;
import com.acc.domain.AuthenticationToken;
import com.acc.user.controller.validator.TokenCreationValidator;
import com.acc.user.controller.validator.TokenRefreshValidator;
import com.acc.user.controller.validator.UserListValidator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.acc.user.controller.request.AuthenticationRequestBody;
import com.acc.user.controller.request.UserSearchRequestBody;

@Configuration(value = "com.acc.user.ValidatorConfiguration")
public class ValidatorConfiguration {

  public static final String TOKEN_CREATION = "TOKEN_CREATION_VALIDATOR";
  public static final String TOKEN_REFRESH = "TOKEN_REFRESH_VALIDATOR";
  public static final String USER_LIST = "USER_LIST";

  @Bean(name = TOKEN_CREATION)
  public Validator<AuthenticationRequestBody> tokenCreationValidator() {
    return new TokenCreationValidator();
  }

  @Bean(name = TOKEN_REFRESH)
  public Validator<AuthenticationToken> tokenRefreshValidator() {
    return new TokenRefreshValidator();
  }

  @Bean(name = USER_LIST)
  public Validator<UserSearchRequestBody> userListValidator() {
    return new UserListValidator();
  }
}
