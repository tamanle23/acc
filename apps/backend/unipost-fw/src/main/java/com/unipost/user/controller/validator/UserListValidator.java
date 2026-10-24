package com.unipost.user.controller.validator;

import br.com.fluentvalidator.AbstractValidator;
import com.unipost.core.io.PageRequest;
import com.unipost.core.io.validation.ViolationMessage;
import com.unipost.user.controller.request.AuthenticationRequestBody;
import com.unipost.user.controller.request.UserSearchRequestBody;
import org.springframework.stereotype.Component;

import java.util.Optional;

import static br.com.fluentvalidator.predicate.LogicalPredicate.not;
import static br.com.fluentvalidator.predicate.StringPredicate.stringEmptyOrNull;
import static br.com.fluentvalidator.predicate.ObjectPredicate.*;

@Component
public class UserListValidator extends AbstractValidator<UserSearchRequestBody> {

  @Override
  public void rules() {
    setPropertyOnContext("userSearchRequestBody");

    ruleFor(UserSearchRequestBody::getPageRequest)
      .must(not(nullValue()))
        .withMessage("pageRequest must not be null")
        .withFieldName("pageRequest")
      .critical();
  }


}
