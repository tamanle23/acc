package com.unipost.user.repository.mybatis;

import java.util.List;

import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import com.unipost.core.io.PageRequest;
import com.unipost.user.model.User;

@Mapper
public interface UserSearchRepository {
  public Long count();
  public List<User> findBy(@Param("pageRequest") PageRequest pageRequest);
}
