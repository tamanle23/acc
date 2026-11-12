package com.acc.fw.helper;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

public class HttpServletRequestHelpers {
	public static HttpServletRequest getRequest() {
		if (RequestContextHolder.getRequestAttributes() != null) {
			return ((ServletRequestAttributes) RequestContextHolder.getRequestAttributes()).getRequest();
		} else {
			return null;
		}
	}
}
