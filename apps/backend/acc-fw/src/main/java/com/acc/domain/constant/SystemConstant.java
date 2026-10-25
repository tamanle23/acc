package com.acc.domain.constant;

import java.io.File;

public class SystemConstant {
  public static final String APPLICATION_PROPERTIES = "APPLICATION_PROPERTIES";
  public static final String PATH_HOME = System.getProperty("user.home") + File.separator + "acc";
  public static final String PATH_QR_CODE = PATH_HOME + File.separator + "qr";

  public static final String BEAN_NAME_MESSAGES = "messages";
  public static final String BEAN_NAME_PAGING = "page";
  public static final String OVERWRITE = "overwrite";

  public static final String ISO_DATE_FORMAT = "yyyy-MM-dd";
  public static final String ISO_DATE_TIME_FORMAT = "yyyy-MM-dd'T'HH:mm:ss'Z'";
  public static final String ISO_DATE_TIME_FORMAT_TZ = "yyyy-MM-dd HH:mm:ssZ";
}
