package com.acc.fw.i18n;

import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import jakarta.inject.Inject;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.InitializingBean;
import org.springframework.context.support.AbstractMessageSource;
import org.springframework.util.Assert;

import com.acc.fw.helper.LocaleHelpers;

public class InitializableMessageSource extends AbstractMessageSource implements InitializingBean {
  protected Map<Locale, List<String>> resolvingPath;
  protected Map<String, Map<String, String>> messages = new HashMap<String, Map<String, String>>();
  protected Locale defaultLocale;
  @Inject
  protected MessageProvider messageProvider;
  protected boolean autoInitialization;

  public InitializableMessageSource() {
    this.resolvingPath = new HashMap<Locale, List<String>>();
  }

  private void addMessage(String locale, String code,String messageFormat) {
    String localeString = (locale != null ? locale : "");
    Map<String, String> codeMap = messages.get(localeString);

    if (codeMap == null) {
      codeMap = new HashMap<String, String>();
      messages.put(localeString, codeMap);
    }

    codeMap.put(code, messageFormat);
  }

  public void afterPropertiesSet() throws Exception {
    if (this.autoInitialization){
      initialize();
    }
  }

  public Locale getDefaultLocale() {
    return this.defaultLocale;
  }

  private List<String> getPath(Locale locale) {
    List<String> paths = resolvingPath.get(locale);
    if (paths == null) {
      paths = new ArrayList<String>();

      List<Locale> localePath = LocaleHelpers.getPath(locale,
          getDefaultLocale());
      for (Locale loc : localePath) {
        if (loc == null) {
          paths.add("");
        } else {

          String language = LocaleHelpers.getLanguage(loc);
          String country = LocaleHelpers.getCountry(loc);
          String variant = LocaleHelpers.getVariant(loc);
          if (!variant.isEmpty()) {
            paths.add(String.format("%s_%s_%s", language, country,
                variant));
          } else if (!country.isEmpty()) {
            paths.add(String.format("%s_%s", language, country));
          } else if (!language.isEmpty()) {
            paths.add(String.format("%s", language));
          }
        }

      }

      resolvingPath.put(locale, paths);
    }
    return paths;
  }

  public void initialize() {
    Messages messages = messageProvider.getMessages();
    if(messages!=null){
      for (String locale : messages.getLocales()) {
        Map<String, String> codeToMessage = messages.getMessages(locale);

        for (String code : codeToMessage.keySet()) {
          try {
            addMessage(locale, code, codeToMessage.get(code));
          } catch (RuntimeException e) {
            throw new RuntimeException(
                String.format("ERROR processing Message code=%s locale=%s , %s", code, locale, e.getMessage()), e);
          }
        }
      }
    }

  }

  protected MessageFormat resolveCode(String code, Locale locale) {
    List<String> paths = getPath(locale);
    for (String loc : paths) {
      Map<String, String> formatMap = messages.get(loc);
      if (formatMap != null) {
        String pattern = formatMap.get(code);
        if (StringUtils.isNotBlank(pattern)) {
          MessageFormat format = createMessageFormat(pattern,locale);
          if (format.getLocale() == null) {
            format.setLocale(defaultLocale);
          }
          return format;
        }
      }
    }

    return createMessageFormat(code.replace("{", "'{").replace("}", "}'"), locale);
  }

  public void setAutoInitialize(boolean autoInitialize) {
    this.autoInitialization = autoInitialize;
  }

  public void setDefaultLocale(Locale defaultLocale) {
    this.defaultLocale = defaultLocale;
  }

  public void setMessageProvider(MessageProvider messageProvider) {
    Assert.notNull(messageProvider, "messageProvider must not be null");
    this.messageProvider = messageProvider;
  }

  public void setAutoInitialization(boolean autoInitialization) {
    this.autoInitialization = autoInitialization;
  }

  public Map<String, Map<String, String>> getMessages() {
    return this.messages;
  }
}