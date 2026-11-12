package com.acc.fw.helper;

import org.springframework.web.util.UriUtils;

public class Jstl {
  public static String escape(String str) {
    return UriUtils.encode(str, "UTF-8");
  }
}
