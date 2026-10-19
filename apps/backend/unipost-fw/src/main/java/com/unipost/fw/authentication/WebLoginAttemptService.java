package com.unipost.fw.authentication;

import java.util.concurrent.TimeUnit;

import com.unipost.service.user.LoginAttemptService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;

/**
 * Login attempts tracking service
 */
@Component
public class WebLoginAttemptService implements LoginAttemptService{

  private Logger logger = LoggerFactory.getLogger(WebLoginAttemptService.class);
  private final int MAX_ATTEMPT = 3;
  private Cache<String, Integer> cacheMap;

  public WebLoginAttemptService() {
    super();
    cacheMap = CacheBuilder.newBuilder()
                           .concurrencyLevel(8)
                           .maximumSize(100000)
                           .expireAfterAccess(10, TimeUnit.MINUTES)
                           .<String,Integer>build();
}

  public void loginSucceeded(String key,String sessionId) {
    cacheMap.asMap().remove(key);
  }

  public void loginFailed(String key,String sessionId) {
    Integer attempts = cacheMap.getIfPresent(key);
    if(attempts==null){
      attempts = 0 ;
    }
    attempts++;
    cacheMap.put(key, attempts);
  }

  public boolean isBlocked(String key) {
    boolean isBlocked=false;
    
    Integer attempts = cacheMap.getIfPresent(key);
    isBlocked = !(attempts == null || attempts < MAX_ATTEMPT);
    
    return isBlocked;
  }
  
  @Scheduled(cron = "${com.unipost.authentication.attempts.cleanup.cron.expression:0 30/15 * * * *}")
  public void cleanupAttemps() {
    if (cacheMap != null) {
      long sizeBefore = cacheMap.size();
      cacheMap.cleanUp();
      logger.info("Evicted expired login attempts from cache. Active entries: {} (was: {})", cacheMap.size(), sizeBefore);
    }
  }
}