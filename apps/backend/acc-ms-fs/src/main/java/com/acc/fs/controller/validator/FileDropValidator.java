package com.acc.fs.controller.validator;

import br.com.fluentvalidator.AbstractValidator;
import com.acc.fs.controller.request.FileDropRequestBody;
import org.apache.commons.collections4.CollectionUtils;

import java.util.function.Function;

import static br.com.fluentvalidator.predicate.LogicalPredicate.not;


public class FileDropValidator extends AbstractValidator<FileDropRequestBody> {

  @Override
  public void rules() {
    setPropertyOnContext("fileRemovalRequestBody");

    ruleFor(Function.identity())
      .must(not(b -> CollectionUtils.isEmpty(b.getCopy()) && CollectionUtils.isEmpty(b.getCut())))
        .withMessage("Droplist must has either cut or copy.")
        .withFieldName("dropList")
      .critical();
  }
}
