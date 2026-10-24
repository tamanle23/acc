package com.unipost.user.event;

import java.util.Locale;

import org.springframework.context.ApplicationEvent;

import com.unipost.user.model.User;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class OnRegistrationCompleteEvent extends ApplicationEvent {

  private static final long serialVersionUID = 39498803973062947L;
  private final String appUrl;
  private final Locale locale;
  private final User user;

  public OnRegistrationCompleteEvent(final User user, final Locale locale, final String appUrl) {
    super(user);
    this.user = user;
    this.locale = locale;
    this.appUrl = appUrl;
  }
}