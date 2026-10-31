package com.acc.boot.config;

import com.acc.user.controller.mapping.RoleMapper;
import com.acc.user.controller.mapping.UserMapper;
import org.mapstruct.factory.Mappers;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class UserMappingConfiguration {

  @Bean
  @ConditionalOnMissingBean(UserMapper.class)
  public UserMapper userMapper() {
    return Mappers.getMapper(UserMapper.class);
  }

  @Bean
  @ConditionalOnMissingBean(RoleMapper.class)
  public RoleMapper roleMapper() {
    return Mappers.getMapper(RoleMapper.class);
  }
}
