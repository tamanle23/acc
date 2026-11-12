package com.acc.core.helper;

import org.apache.commons.lang3.StringUtils;

public class ObjectHelper {
    
  public static final ObjectHelper INSTANCE = new ObjectHelper();
  
  public <T>T nvl(T obj,T defaultValue){
   if(obj == null) 
     return defaultValue;
   if(obj instanceof String && StringUtils.isBlank((String)obj))
     return defaultValue;
   return obj;
  }
}
