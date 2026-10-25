package com.acc.fw.context;

import java.util.regex.Pattern;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.security.web.util.matcher.RegexRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

public class CsrfSecurityRequestMatcher implements RequestMatcher,InitializingBean {
	private Pattern allowedMethods = Pattern.compile("^(GET|HEAD|TRACE|OPTIONS)$");
	private RegexRequestMatcher unprotectedMatcher = null;
	private String ignoredUrlPattern ;
	
	public void setIgnoredUrlPattern(String ignoredUrlPattern) {
		this.ignoredUrlPattern = ignoredUrlPattern;
	}
	
	@Override
	public boolean matches(HttpServletRequest request) {
		if (allowedMethods.matcher(request.getMethod()).matches()) {
			return false;
		}
		return unprotectedMatcher == null || !unprotectedMatcher.matches(request);
	}


	@Override
	public void afterPropertiesSet() throws Exception {
		if(ignoredUrlPattern != null) {
			unprotectedMatcher = new RegexRequestMatcher(ignoredUrlPattern, null);
		}
	}


	


}