package com.acc.core.helper;

import java.util.Map;
import java.util.WeakHashMap;
import java.util.regex.Pattern;

public class RegexHelper {
    
  private Map<String,Pattern> patterns = new WeakHashMap<String,Pattern>();
  public static RegexHelper INSTANCE = new RegexHelper();
  
  public boolean check(String str,String pattern){
    Pattern regex = null;
    if(!patterns.containsKey(pattern)){
        regex = Pattern.compile(pattern);
        patterns.put(pattern, regex);
    } else {
        regex = patterns.get(pattern);
    }
    
    return regex.matcher(str).matches();
  }
}
