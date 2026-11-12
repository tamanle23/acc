package com.acc.core.helper;

import java.time.LocalDateTime;
import java.util.Date;

public class DateTimeHelper {
  
  public static LocalDateTime getCurrentDateTime() {
    return LocalDateTime.now();
  }
  
  public static Date getDate() {
    return new Date();
  }
}
