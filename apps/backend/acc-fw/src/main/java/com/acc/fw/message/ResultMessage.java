package com.acc.fw.message;

import java.io.Serializable;

import org.springframework.util.Assert;

public class ResultMessage implements Serializable {

  private static final long serialVersionUID = -2478301301510195660L;

  private final String code;

  private final Object[] args;

  private final String text;

  private static final Object[] EMPTY_ARRAY = new Object[0];

  public ResultMessage(String code, Object[] args, String text) {
    this.code = code;
    this.args = args == null ? EMPTY_ARRAY : args;
    this.text = text;
  }

  public String getCode() {
    return code;
  }

  public Object[] getArgs() {
    return args;
  }

  public String getText() {
    return text;
  }

  public static ResultMessage fromCode(String code, Object... args) {
    Assert.notNull(code, "code must not be null");
    return new ResultMessage(code, args, null);
  }

  public static ResultMessage fromText(String text) {
    Assert.notNull(text, "text must not be null");
    return new ResultMessage(null, EMPTY_ARRAY, text);
  }
}
