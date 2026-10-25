package com.acc.core.io.validation.message;

import java.util.Locale;

@FunctionalInterface
public interface MessageFormatter {
  String format(String messageKey, String defaultMessageFormat, Object[] args, Locale locale);
}
