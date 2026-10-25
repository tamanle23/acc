package com.acc.core.io;

import java.util.function.Function;

import com.acc.core.context.Context;

public abstract class CommonReponseBuilder {

  protected abstract Context getContext();

  protected <B>ResponseWrapper<ContextHeader, B> success() {
    return success(null);
  }

  protected <B>ResponseWrapper<ContextHeader, B> success(B body) {
    return ResponseWrapper.success(getContext().getHeader(), body);
  }

  protected <B>ResponseWrapper<ContextHeader, B> error(Error... errors) {
    return ResponseWrapper.error(getContext().getHeader(), errors);
  }

  protected <B>ResponseWrapper<ContextHeader, B> fail(Error... errors) {
    return ResponseWrapper.fail(getContext().getHeader(),errors);
  }

  protected <T>RequestWrapper<ContextHeader, T> extractRequest(T requestBody) {
    return RequestWrapper.create(getContext().getHeader(), requestBody);
  }

  protected <B>ResponseWrapper<ContextHeader, B> success(final B body, Function<B, Status> statusFactory) {
    return ResponseWrapper.create(statusFactory.apply(body), getContext().getHeader(), body);
  }
}
