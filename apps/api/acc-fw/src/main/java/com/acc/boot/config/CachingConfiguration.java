package com.acc.boot.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.core.context.Context;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.CachingConfigurerSupport;
import org.springframework.cache.annotation.EnableCaching;
import org.springframework.cache.interceptor.KeyGenerator;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.data.redis.cache.RedisCacheConfiguration;
import org.springframework.data.redis.serializer.GenericJackson2JsonRedisSerializer;
import org.springframework.data.redis.serializer.RedisSerializationContext.SerializationPair;
import org.springframework.data.redis.serializer.StringRedisSerializer;

import java.lang.reflect.Method;
import java.time.Duration;

@Profile("cache")
@Configuration
@EnableCaching
public class CachingConfiguration extends CachingConfigurerSupport {

  @Autowired
  Context context;

  @Bean
  public RedisCacheConfiguration defaultCacheConfiguration(@Autowired ObjectMapper objectMapper) {
    return RedisCacheConfiguration.defaultCacheConfig()
                                  .serializeKeysWith(
                                      SerializationPair.fromSerializer(
                                          new StringRedisSerializer()
                                      )
                                  )
                                  .serializeValuesWith(
                                      SerializationPair.fromSerializer(new GenericJackson2JsonRedisSerializer(objectMapper))
                                  )
                                  .entryTtl(Duration.ofMinutes(60))
                                  .disableCachingNullValues()
                                  .entryTtl(Duration.ofSeconds(60));

  }

  @Bean
  @Override
  public KeyGenerator keyGenerator() {
    return (Object target, Method method, Object... params) -> {
      StringBuilder sb = new StringBuilder();
      sb.append(context.getAuthenticationUser());
      sb.append(":");
      sb.append(target.getClass().getName());
      sb.append(":");
      sb.append(method.getName());
      sb.append(":");
      for (Object obj : params) {
        sb.append(obj.hashCode());
        sb.append(":");
      }
      return sb.toString();
    };
  }

}
