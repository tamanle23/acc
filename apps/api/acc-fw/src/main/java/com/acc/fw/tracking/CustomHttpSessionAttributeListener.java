package com.acc.fw.tracking;

import jakarta.servlet.http.HttpSessionAttributeListener;
import jakarta.servlet.http.HttpSessionBindingEvent;

import org.springframework.stereotype.Component;

@Component
public class CustomHttpSessionAttributeListener implements HttpSessionAttributeListener {

  @Override
  public void attributeAdded(HttpSessionBindingEvent event) {
  }

  @Override
  public void attributeRemoved(HttpSessionBindingEvent event) {
  }

  @Override
  public void attributeReplaced(HttpSessionBindingEvent event) {
  }
}
