package com.acc.fw.i18n;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

public class Messages {
	private Map<String, Map<String, String>> messages;

	public Messages(Map<String, Map<String, String>> messages) {
		this.messages = messages;
	}

	public Messages() {
		this.messages = new HashMap<String, Map<String, String>>();
	}

	public Set<String> getLocales() {
		return this.messages.keySet();
	}

	public Map<String, String> getMessages(String locale) {
		return this.messages.get(locale);
	}

	public void setMessages(String locale, Map<String, String> map) {
		this.messages.put(locale, map);
	}

	public void addMessage(String locale, String key, String message) {
		Map<String, String> keyToMessage = this.messages.get(locale);
		if (keyToMessage == null) {
			keyToMessage = new HashMap<String, String>();
			this.messages.put(locale, keyToMessage);
		}
		keyToMessage.put(key, message);
	}

	public void removeMessage(Locale locale, String key) {
		Map<String, String> keyToMessage = this.messages.get(locale);
		if (keyToMessage == null) {
			return;
		}
		keyToMessage.remove(key);
	}

	public String getMessage(Locale locale, String key) {
		Map<String, String> localeMessages = this.messages.get(locale);
		if (localeMessages == null) {
			return null;
		}
		return ((String) localeMessages.get(key));
	}

	public boolean hasMessage(Locale locale, String key) {
		return (getMessage(locale, key) != null);
	}
}