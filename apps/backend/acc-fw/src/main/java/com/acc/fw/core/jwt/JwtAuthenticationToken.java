package com.acc.fw.core.jwt;

import java.util.Collection;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;

import io.jsonwebtoken.Claims;

public class JwtAuthenticationToken extends AbstractAuthenticationToken {

  private static final long serialVersionUID = 1690534081353206927L;
  private final Object principal;
  private final String tenantId;
  private Object credentials;

  public JwtAuthenticationToken(String principal, Claims credentials, Collection<? extends GrantedAuthority> authorities) {
    this(principal, credentials, authorities, null);
  }

  public JwtAuthenticationToken(String principal, Claims credentials, Collection<? extends GrantedAuthority> authorities, String tenantId) {
    super(authorities);
    this.principal = principal;
    this.credentials = credentials;
    this.tenantId = tenantId;
    super.setAuthenticated(true);
  }

  public Object getCredentials() {
    return this.credentials;
  }

  public Object getPrincipal() {
    return this.principal;
  }

  public String getTenantId() {
    return this.tenantId;
  }

  @Override
  public void eraseCredentials() {
    super.eraseCredentials();
    credentials = null;
  }
}
