package com.acc.fw.helper;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import org.springframework.beans.propertyeditors.LocaleEditor;
import org.springframework.util.StringUtils;
import org.springframework.web.servlet.support.RequestContextUtils;

public class LocaleHelpers {

	private LocaleHelpers() {

	}

	public static Locale getCurrentLocale() {
		return new Locale("en");
	}

	public static Locale toLocale(String locale) {
		if (locale == null) {
			return null;
		}
		LocaleEditor led = new LocaleEditor();
		led.setAsText(locale);
		return (Locale) led.getValue();
	}

	public static String fromLocale(Locale locale) {

		if (locale == null) {
			return null;
		}
		LocaleEditor led = new LocaleEditor();
		led.setValue(locale);
		return led.getAsText();
	}

	public static Locale toLocale(String language, String country,
			String variant) {

		if (variant == null) {
			if (country == null) {
				if (language == null) {
					return toLocale(null);
				}
				return toLocale(language);
			}
			return toLocale(String.format("%s_%s", language, country));
		}

		return toLocale(String.format("%s_%s_%s", language, country, variant));

	}

	public static String getLanguage(Locale locale) {

		if (locale != null && StringUtils.hasLength(locale.getLanguage())) {
			return locale.getLanguage();
		}
		return "";
	}

	public static String getCountry(Locale locale) {

		if (locale != null && StringUtils.hasLength(locale.getCountry())) {
			return locale.getCountry();
		}
		return "";
	}

	public static String getVariant(Locale locale) {

		if (locale != null && StringUtils.hasLength(locale.getVariant())) {
			return locale.getVariant();
		}
		return "";
	}

	public static Locale getParent(Locale locale) {

		if (locale == null) {
			return null;
		}
		if (StringUtils.hasLength(locale.getVariant())) {
			return new Locale(locale.getLanguage(), locale.getCountry());
		} else if (StringUtils.hasLength(locale.getCountry())) {
			return new Locale(locale.getLanguage());
		} else {
			return null;
		}
	}

	/**
	 * Returns the Message-Resolving path of a given {@link Locale} and default-
	 * {@link Locale}: Example:
	 * <ul>
	 * <li>de_DE and en_US as default leads to: de_DE, de, en_US, en, null</li>
	 * <li>de_DE and null as default leads to: de_DE, de, null</li>
	 * <li>de_DE and de_DE as default leads to: de_DE, de, null</li>
	 * </ul>
	 * 
	 * @param locale
	 *            the {@link Locale} to get the path for
	 * @param defaultLocale
	 *            the default-locale to consider within the path
	 * @return a {@link List} containing the path
	 */
	public static List<Locale> getPath(Locale locale, Locale defaultLocale) {

		List<Locale> path = new ArrayList<Locale>();

		boolean localeWasNull = locale == null;

		// path down to only language (e.g. de_DE_POSIX -> de_DE -> de)
		while (locale != null) {
			path.add(locale);
			locale = getParent(locale);
		}

		if (!localeWasNull && locale != defaultLocale) {
			// path of default locale down to only language (e.g. en_US -> en )
			while (defaultLocale != null) {
				path.add(defaultLocale);
				defaultLocale = getParent(defaultLocale);
			}

		}
		// default locale
		path.add(null);

		return path;
	}

	public static String getRequestLocale() {
		return fromLocale(RequestContextUtils.getLocale(HttpServletRequestHelpers.getRequest()));
	}

}