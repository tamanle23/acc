package com.acc.aio.controller;

import java.text.SimpleDateFormat;
import java.util.Date;

import jakarta.inject.Inject;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.propertyeditors.CustomDateEditor;
import org.springframework.beans.propertyeditors.StringTrimmerEditor;
import org.springframework.context.annotation.Profile;
import org.springframework.ui.Model;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.InitBinder;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@ControllerAdvice
@Profile("webjsp")
public class GlobalBindingInitializer extends ResponseEntityExceptionHandler {

	private Logger logger = LoggerFactory.getLogger(GlobalBindingInitializer.class);

	@Autowired
	BeanFactory factory;

	@InitBinder
	public void binder(WebDataBinder binder) {
//		binder.registerCustomEditor(Integer.class, null, new CustomNumberEditor(Integer.class, null, true));
//		binder.registerCustomEditor(Long.class, null, new CustomNumberEditor( Long.class, null, true));
//		binder.registerCustomEditor(Boolean.class, null, new CustomBooleanEditor(true));
//		binder.registerCustomEditor(byte[].class, new ByteArrayMultipartFileEditor());
		binder.registerCustomEditor(String.class, new StringTrimmerEditor(false));
	}

	@ModelAttribute
	public void initBaseForm(Model model) {
//		model.addAttribute("codelist",factory.getBean(Codelist.class));
//		model.addAttribute("currentLocale",LocaleUtils.getRequestLocale());
//		model.addAttribute("currentUser",sessionService.get(SessionConstant.SESSION_ACCOUNT));
	}
}
