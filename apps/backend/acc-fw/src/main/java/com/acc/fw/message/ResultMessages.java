package com.acc.fw.message;

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Iterator;
import java.util.List;

import org.apache.commons.lang3.StringUtils;
import org.springframework.util.Assert;

public class ResultMessages implements Iterable<ResultMessage>, Serializable {

  private static final long serialVersionUID = 7929253728827004913L;

  public enum ResultMessageType {
    SUCCESS("success"), INFO("info"), WARNING("warning"), ERROR("error"), DANGER("danger");

    private final String type;

    private ResultMessageType(String type) {
      this.type = type;
    }

    public String getType() {
      return this.type;
    }

    @Override
    public String toString() {
      return this.type;
    }
  }

  public static final String DEFAULT_MESSAGES_ATTRIBUTE_NAME = StringUtils.uncapitalize(ResultMessages.class.getSimpleName());

  private final List<ResultMessage> list = new ArrayList<ResultMessage>();

  private ResultMessageType type;

  public ResultMessages(ResultMessageType type) {
    this(type, (ResultMessage[]) null);
  }

  public List<ResultMessage> getList() {
    return list;
  }

  public ResultMessages(ResultMessageType type, ResultMessage... messages) {
    if (type == null) {
      throw new IllegalArgumentException("type must not be null!");
    }
    this.setType(type);
    if (messages != null) {
      addAll(messages);
    }
  }

  public ResultMessages add(ResultMessage message) {
    Assert.notNull(message, "message must not be null");
    this.list.add(message);
    return this;
  }

  public ResultMessages add(String code) {
    Assert.notNull(code, "code must not be null");
    this.add(ResultMessage.fromCode(code));
    return this;
  }

  public ResultMessages add(String code, Object... args) {
    Assert.notNull(code, "code must not be null");
    this.add(ResultMessage.fromCode(code, args));
    return this;
  }

  public ResultMessages addAll(Collection<ResultMessage> messages) {
    Assert.notNull(messages, "messages must not be null");
    for (ResultMessage message : messages) {
      add(message);
    }
    return this;
  }

  public ResultMessages addAll(ResultMessage... messages) {
    Assert.notNull(messages, "messages must not be null");
    for (ResultMessage message : messages) {
      add(message);
    }
    return this;
  }

  public ResultMessageType getType() {
    return type;
  }

  @Override
  public Iterator<ResultMessage> iterator() {
    return list.iterator();
  }

  public void setType(ResultMessageType type) {
    this.type = type;
  }

  public static ResultMessages warning() {
    return new ResultMessages(ResultMessageType.WARNING);
  }

  public static ResultMessages error() {
    return new ResultMessages(ResultMessageType.ERROR);
  }

  public static ResultMessages danger() {
    return new ResultMessages(ResultMessageType.DANGER);
  }

  public static ResultMessages info() {
    return new ResultMessages(ResultMessageType.INFO);
  }

  public static ResultMessages success() {
    return new ResultMessages(ResultMessageType.SUCCESS);
  }
}
