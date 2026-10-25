package com.acc.fw.tracking;

import jakarta.servlet.http.HttpSessionEvent;
import jakarta.servlet.http.HttpSessionListener;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

@Component
public class CustomHttpSessionListener implements HttpSessionListener {

  Logger logger = LoggerFactory.getLogger(CustomHttpSessionListener.class);
  
  @Override
  public void sessionCreated(HttpSessionEvent se) {
    logger.debug("### Session created: {} MaxInactive {}", se.getSession().getId(), se.getSession().getMaxInactiveInterval());
  }

  @Override
  public void sessionDestroyed(HttpSessionEvent se) {
    logger.debug("### Session destroyed: {} Last acccess time {}", se.getSession().getId(), se.getSession().getLastAccessedTime());
  }

}
