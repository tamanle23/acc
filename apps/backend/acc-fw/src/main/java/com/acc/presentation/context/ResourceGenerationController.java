package com.acc.presentation.context;

import java.util.Map;

import jakarta.inject.Inject;

import org.springframework.context.MessageSource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;

import com.acc.fw.i18n.InitializableMessageSource;

//@Controller
//@RequestMapping("/resources")
public class ResourceGenerationController {
  
  @Inject
  MessageSource messageSource;
  
  @RequestMapping(value="jsMessageSource.js",method = RequestMethod.GET)
  public ResponseEntity<String> generateJsMessageSource(Model model) {
    Map<String, Map<String, String>> messages;
    StringBuilder scriptBuilder = new StringBuilder();
    if(messageSource instanceof InitializableMessageSource){
      messages = ((InitializableMessageSource)messageSource).getMessages();
      scriptBuilder.append("window.messageSource ={");
      for(String locale: messages.keySet()){
        scriptBuilder.append("\"");
        scriptBuilder.append(locale);
        scriptBuilder.append("\"");
        scriptBuilder.append(":{");
        for(String messageKey :messages.get(locale).keySet()){
          scriptBuilder.append("\"");
          scriptBuilder.append(messageKey);
          scriptBuilder.append("\": \"");
          scriptBuilder.append(messages.get(locale).get(messageKey));
          scriptBuilder.append("\",");
        }
        if(messages.get(locale).size()>0) {
          scriptBuilder.deleteCharAt(scriptBuilder.length()-1);
        }
        scriptBuilder.append(locale + "}");
      }
      scriptBuilder.append("}");
    }
    
    return ResponseEntity.ok()
              .header(HttpHeaders.CONTENT_TYPE, "text/javascript")
              .body(scriptBuilder.toString());
  }
}
