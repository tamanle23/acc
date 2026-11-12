package com.acc.repository.mybatis;

import com.acc.core.io.SearchCondition;
import org.apache.ibatis.annotations.Param;

import java.util.List;

public interface SearchRepository<T,S extends SearchCondition> {

  public Long countBy(@Param("searchRequest") S searchRequest);
  public List<T> findBy(@Param("searchRequest") S searchRequest);
}
