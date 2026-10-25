package com.acc.service.authentication;

import java.util.Collection;
import java.util.Date;
import java.util.HashMap;
import java.util.Map;

import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import com.fasterxml.jackson.annotation.JsonAnyGetter;
import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Getter;
import lombok.Setter;

public class UserDetailsImpl implements UserDetails {

  private static final long serialVersionUID = -7541929085537697197L;

  private Map<String, Object> userDetails;
  @JsonIgnore
  private Collection<? extends GrantedAuthority> authorities;
  @Getter
  @Setter
  private Date lastPasswordResetDate;

  public UserDetailsImpl() {
    this.userDetails = new HashMap<>();
  }

  public UserDetailsImpl(Map<String, Object> userDetails, Collection<? extends GrantedAuthority> authorities) {
    this.userDetails = userDetails;
    this.authorities = authorities;
  }

  public void setAuthorities(Collection<? extends GrantedAuthority> authorities) {
    this.authorities = authorities;
  }

  @JsonAnySetter
  public void setAdditionalProperty(String key, Object value) {
    userDetails.put(key, value);
  }

  @JsonAnyGetter
  public Map<String, Object> getUserDetails(String key, Object value) {
    return userDetails;
  }

  @Override
  @JsonIgnore
  public Collection<? extends GrantedAuthority> getAuthorities() {
    return authorities;
  }

  @Override
  @JsonIgnore
  public String getPassword() {
    return (String) this.userDetails.get("password");
  }

  @Override
  @JsonIgnore
  public String getUsername() {
    return (String) this.userDetails.get("userName");
  }

  public String getUserName() {
    return (String) this.userDetails.get("userName");
  }

  public String getUid() {
    return (String) this.userDetails.get("uid");
  }

  @Override
  public boolean isAccountNonExpired() {
    return (boolean) this.userDetails.get("isNonExpired");
  }

  @Override
  public boolean isAccountNonLocked() {
    return (boolean) this.userDetails.get("isNonLocked");
  }

  @Override
  public boolean isCredentialsNonExpired() {
    return (boolean) this.userDetails.get("isCredentialsNonExpired");
  }

  @Override
  public boolean isEnabled() {
    return (boolean) this.userDetails.get("isEnabled");
  }

  public String getUserType() {
    return (String) this.userDetails.get("userType");
  }
}
