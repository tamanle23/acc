package com.unipost.user.controller.validator;

import br.com.fluentvalidator.AbstractValidator;
import com.unipost.domain.AuthenticationToken;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Component;

import static br.com.fluentvalidator.predicate.LogicalPredicate.not;
import static br.com.fluentvalidator.predicate.StringPredicate.stringEmptyOrNull;

@Component
public class TokenRefreshValidator extends AbstractValidator<AuthenticationToken> {

  @Override
  public void rules() {
    setPropertyOnContext("authenticationToken");

    ruleFor(token -> {
      if (token == null) {
        return null;
      }
      if (StringUtils.isNotBlank(token.getRefreshToken())) {
        return token.getRefreshToken();
      }
      return token.getAccessToken();
    })
    .must(not(stringEmptyOrNull()))
      .withMessage("Refresh token or token must not be empty")
      .withFieldName("refreshToken")
    .critical();
  }
}
