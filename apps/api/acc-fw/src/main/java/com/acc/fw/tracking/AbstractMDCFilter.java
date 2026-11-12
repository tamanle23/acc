package com.acc.fw.tracking;

import java.io.IOException;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.MDC;
import org.springframework.web.filter.OncePerRequestFilter;

public abstract class AbstractMDCFilter extends OncePerRequestFilter {
  private boolean removeValue = false;

  private int maxMDCValueLength = 32;

  public void setRemoveValue(boolean removeValue) {
    this.removeValue = removeValue;
  }

  public void setMaxMDCValueLength(int maxMDCValueLength) {
    this.maxMDCValueLength = maxMDCValueLength;
  }

  protected String cutValue(String value) {
    if (value != null && maxMDCValueLength >= 0 && value.length() > maxMDCValueLength) {
      return value.substring(0, maxMDCValueLength);
    } else {
      return value;
    }

  }

  @Override
  protected final void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
      FilterChain filterChain) throws ServletException, IOException {
    String key = getMDCKey(request, response);
    String value = getMDCValue(request, response);
    MDC.put(key, cutValue(value));
    try {
      filterChain.doFilter(request, response);
    } finally {
      if (removeValue) {
        MDC.remove(key);
      }
    }
  }

  protected abstract String getMDCKey(HttpServletRequest request, HttpServletResponse response);

  protected abstract String getMDCValue(HttpServletRequest request, HttpServletResponse response);
}