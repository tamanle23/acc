package com.acc.fw;

import java.util.Date;
import java.util.Map;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.web.error.ErrorAttributeOptions;
import org.springframework.boot.webmvc.error.DefaultErrorAttributes;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.WebRequest;

import com.acc.core.helper.ExceptionHelper;
import com.acc.core.helper.ExceptionHelper.ErrorMessage;

@Component
public class CustomErrorAttributes extends DefaultErrorAttributes {

  private Logger logger = LoggerFactory.getLogger(CustomErrorAttributes.class);

  @Autowired
  ObjectMapper objectMapper;

  @Override
  public Map<String, Object> getErrorAttributes(WebRequest webRequest, ErrorAttributeOptions options) {
    Map<String, Object> errorAttributes = super.getErrorAttributes(webRequest, options);
    ErrorMessage errorMessage = ExceptionHelper.logException(logger, super.getError(webRequest));
    if (errorMessage != null) {
      errorAttributes.put("errorCode", errorMessage.getErrorCode());
    }
    errorAttributes.put("timestamp", new Date());
    return errorAttributes;
  }
}
