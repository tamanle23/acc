package com.acc.fw.tracking;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

public class PrincipalMDCFilter extends AbstractMDCFilter {

  private static final String MDC_PRINCIPAL = "MDC_PRINCIPAL";

  @Override
  protected String getMDCKey(HttpServletRequest request, HttpServletResponse response) {
    return MDC_PRINCIPAL;
  }

  @Override
  protected String getMDCValue(HttpServletRequest request, HttpServletResponse response) {

    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

    if (authentication != null) {
      Object principal = authentication.getPrincipal();
      if (principal instanceof UserDetails) {
        return ((UserDetails) principal).getUsername();
      }
      return principal.toString();
    }

    return null;
  }

}
