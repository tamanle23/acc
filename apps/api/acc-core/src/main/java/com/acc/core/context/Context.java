package com.acc.core.context;

import java.util.List;

import com.acc.core.io.ContextHeader;

public interface Context {

  void init(String contextKey);

  String getKey();

  String getAuthenticationUser();

  boolean isSuper();

  List<String> getAuthorities();

  ContextHeader createHeader(String applicationName, String clientType);

  ContextHeader getHeader();

  void clear();

  void setRequestHeader(ContextHeader currentContext);

  boolean checkPermission(String resource, String permission);
  boolean checkPermissions(String resource, List<String> permissions);

  boolean checkPermission(String permission);
  boolean checkPermissions(List<String> permission);

}
