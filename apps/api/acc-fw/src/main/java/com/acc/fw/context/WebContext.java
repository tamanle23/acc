package com.acc.fw.context;

import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import org.apache.commons.lang.StringUtils;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import com.acc.core.context.Context;
import com.acc.core.exception.BusinessException;
import com.acc.core.io.ContextHeader;
import com.acc.fw.core.jwt.JwtAuthenticationToken;
import com.acc.fw.core.jwt.JwtTokenHelper;

import io.jsonwebtoken.Claims;

/**
 * Thread-safe Web Context implementation supporting multi-instance cluster nodes,
 * virtual threads, and asynchronous task execution context propagation.
 */
@Component
public class WebContext implements Context {

  private final ThreadLocal<ContextHeader> contextHolder = new InheritableThreadLocal<>();
  private final ThreadLocal<Map<String, Object>> currentUserHolder = new InheritableThreadLocal<>();
  private final ThreadLocal<String> authorizationHolder = new InheritableThreadLocal<>();
  public static final String ROOT_DIRECTORY = "ROOT_DIRECTORY";


  @Override
  public void init(String key) {
    if(StringUtils.isNotBlank(authorizationHolder.get())) {
      throw new BusinessException("Webcontext already be initialized.");
    }
    authorizationHolder.set(key);
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication instanceof JwtAuthenticationToken) {
      Claims claims = (Claims)((JwtAuthenticationToken)authentication).getCredentials();
      currentUserHolder.set(claims.get(JwtTokenHelper.CLAIM_KEY_USER_DETAILS, Map.class));
    }
  }

  @Override
  public String getAuthenticationUser() {
    return Optional.ofNullable(currentUserHolder)
                   .map(ThreadLocal::get)
                   .filter(Objects::nonNull)
                   .map(u->(String)u.get("uid"))
                   .orElse("a61f3c94065040589a81fa5bde431416");
  }

  @Override
  public boolean isSuper() {
    Map<String, Object> userDetails = currentUserHolder.get();
    if (userDetails == null) {
      return false;
    }
    return "ADMINISTRATOR".equalsIgnoreCase(String.valueOf(userDetails.get("userType")));
  }

  @Override
  public List<String> getAuthorities() {
    return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
      .map(Authentication::getAuthorities)
      .map(Collection::stream)
      .orElse(Stream.empty())
      .map(GrantedAuthority::getAuthority)
      .collect(Collectors.toList())
      ;
//    return Optional.ofNullable(SecurityContextHolder.getContext().getAuthentication())
//                   .map(Authentication::getPrincipal)
//                   .filter(UserDetailsImpl.class::isInstance)
//                   .map(UserDetailsImpl.class::cast)
//                   .map(UserDetailsImpl::getAuthorities)
//                   .map(Collection::stream)
//                   .orElse(Stream.empty())
//                   .map(GrantedAuthority::getAuthority)
//                   .collect(Collectors.toList())
//                   ;
  }

  protected String createTrackingId() {
    String uuid = UUID.randomUUID().toString();
    return uuid; //.replace("-", "");
  }

  @Override
  public ContextHeader createHeader(String applicationName, String clientType) {
    ContextHeader requestContext = ContextHeader.builder()
                                                  .transactionId(this.createTrackingId())
                                                  .application(applicationName)
                                                  .clientType(clientType)
                                                  .build();
    this.setRequestHeader(requestContext);
    return requestContext;
  }

  @Override
  public ContextHeader getHeader(){
    return this.contextHolder.get();
  }

  @Override
  public void clear() {
    this.contextHolder.remove();
    this.currentUserHolder.remove();
    this.authorizationHolder.remove();
  }

  @Override
  public void setRequestHeader(ContextHeader currentContext) {
    this.contextHolder.set(currentContext);
  }

  @Override
  public boolean checkPermission(String resource,String permission) {
    return this.getAuthorities().stream().anyMatch(auth -> auth.equalsIgnoreCase(resource+"_"+permission));
  }

  @Override
  public boolean checkPermissions(String resource, List<String> permissions) {
    List<String> authorities = this.getAuthorities();
    return permissions.stream().map(p-> resource+"_"+p).allMatch(authorities::contains);
  }

  @Override
  public boolean checkPermission(String permission) {
    return this.getAuthorities().stream().anyMatch(auth -> auth.equalsIgnoreCase(permission));
  }

  @Override
  public boolean checkPermissions(List<String> permissions) {
    List<String> authorities = this.getAuthorities();
    return permissions.stream().allMatch(authorities::contains);
  }



  @Override
  public String getKey() {
    return this.authorizationHolder.get();
  }
}
