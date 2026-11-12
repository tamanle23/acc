package com.acc.fw.i18n;

import java.util.Locale;

import jakarta.validation.MessageInterpolator;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.MessageSource;

import com.acc.fw.helper.LocaleHelpers;

public class CustomMessageInterpolator implements MessageInterpolator {

	private Logger log = LoggerFactory.getLogger(CustomMessageInterpolator.class);

	private MessageSource mesageSource;

	public CustomMessageInterpolator(MessageSource messageSource) {
		this.mesageSource = messageSource;
	}

	public String interpolate(String message, Context context) {
		String interpolatedMessage = message;
		interpolatedMessage = interpolateMessage(message, context, LocaleHelpers.getCurrentLocale());
		return interpolatedMessage;
	}

	public String interpolate(String message, Context context, Locale locale) {
		String interpolatedMessage = message;
		interpolatedMessage = interpolateMessage(message, context, locale);
		return interpolatedMessage;
	}

	private String interpolateMessage(String message, Context context, Locale locale) {
		String resolvedMessage = message;
		try {
			resolvedMessage = mesageSource.getMessage(message, null, locale);
		} catch (Exception ex) {
			log.error(ex.getMessage());
		}
		return resolvedMessage;
	}
}
