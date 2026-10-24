package com.unipost.user.controller.validator;

import br.com.fluentvalidator.AbstractValidator;
import com.unipost.user.controller.request.AuthenticationRequestBody;
import org.springframework.stereotype.Component;

import static br.com.fluentvalidator.predicate.StringPredicate.*;
import static br.com.fluentvalidator.predicate.LogicalPredicate.*;

@Component
public class TokenCreationValidator extends AbstractValidator<AuthenticationRequestBody> {

  @Override
  public void rules() {
    setPropertyOnContext("authenticationRequestBody");

    ruleFor(AuthenticationRequestBody::getUserName)
      .must(not(stringEmptyOrNull()))
        .withMessage("age must be greater than or equal to 10")
        .withFieldName("age")
      .critical();
  }


}
