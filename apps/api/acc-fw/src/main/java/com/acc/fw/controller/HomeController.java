package com.acc.fw.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import com.acc.fw.ResponseEntityBuilder;

@Controller("defaultHomeController")
public class HomeController {
  
    @RequestMapping("/")
    public String home() {
        return "redirect:swagger-ui.html";
    }
//    @Autowired
//    private RequestMappingHandlerMapping handlerMapping;
//
//    @RequestMapping(value="/endpointdoc", method=RequestMethod.GET)
//    public ResponseEntity<?> endpoints() {
//      return ResponseEntityBuilder.success(this.handlerMapping.getHandlerMethods().keySet());
//    } 
}