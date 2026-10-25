package com.acc.worker;

import java.beans.PropertyEditorSupport;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.ResolverStyle;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.lang.Nullable;
import org.springframework.web.bind.WebDataBinder;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.InitBinder;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import com.acc.domain.constant.SystemConstant;

@ControllerAdvice
public class GlobalBindingInitializer extends ResponseEntityExceptionHandler {

  @Autowired
  BeanFactory factory;

  @InitBinder
  public void binder(WebDataBinder binder) {
//  binder.registerCustomEditor(Integer.class, null, new CustomNumberEditor(Integer.class, null, true));
//  binder.registerCustomEditor(Long.class, null, new CustomNumberEditor( Long.class, null, true));
//  binder.registerCustomEditor(Boolean.class, null, new CustomBooleanEditor(true));
//  binder.registerCustomEditor(byte[].class, new ByteArrayMultipartFileEditor());
//  binder.registerCustomEditor(String.class, new StringTrimmerEditor(false));
    binder.registerCustomEditor(LocalDateTime.class, new PropertyEditorSupport() {
      @Override
      public void setAsText(@Nullable String text) {
        if (text == null) {
          setValue(null);
        } else {
          setValue(DateTimeFormatter.ofPattern(SystemConstant.ISO_DATE_TIME_FORMAT).withResolverStyle(ResolverStyle.SMART).parseBest(text, ZonedDateTime::from, LocalDateTime::from));
        }
      }
      @Override
      public String getAsText() {
        return DateTimeFormatter.ofPattern(SystemConstant.ISO_DATE_TIME_FORMAT).withResolverStyle(ResolverStyle.SMART).format((LocalDateTime)this.getValue());
      }
    });
    binder.registerCustomEditor(LocalDate.class, new PropertyEditorSupport() {
      @Override
      public void setAsText(@Nullable String text) {
        if (text == null) {
          setValue(null);
        } else {
          setValue(DateTimeFormatter.ofPattern(SystemConstant.ISO_DATE_FORMAT).withResolverStyle(ResolverStyle.SMART).parse(text, LocalDate::from));
        }
      }
      @Override
      public String getAsText() {
        return DateTimeFormatter.ofPattern(SystemConstant.ISO_DATE_FORMAT).withResolverStyle(ResolverStyle.SMART).format((LocalDate)this.getValue());
      }
    });

    binder.registerCustomEditor(ZonedDateTime.class, new PropertyEditorSupport() {
      @Override
      public void setAsText(@Nullable String text) {
        if (text == null) {
          setValue(null);
        } else {
          setValue(DateTimeFormatter.ofPattern(SystemConstant.ISO_DATE_TIME_FORMAT).withResolverStyle(ResolverStyle.SMART).parseBest(text, ZonedDateTime::from, ZonedDateTime::from));
        }
      }
      @Override
      public String getAsText() {
        return DateTimeFormatter.ofPattern(SystemConstant.ISO_DATE_TIME_FORMAT).withResolverStyle(ResolverStyle.SMART).format((ZonedDateTime)this.getValue());
      }
    });
  }
}
