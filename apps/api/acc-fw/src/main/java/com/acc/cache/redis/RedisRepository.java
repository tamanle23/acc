package com.acc.cache.redis;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Stream;

public interface RedisRepository<T> {

  Stream<T> findAll();

  Stream<T> findAllByIdIn(List<String> ids);

  T findOne(Long id);

  Integer deleteByIdNotIn(List<Long> ids, LocalDateTime date);

  Integer deleteByIdIn(List<Long> ids);

  Integer deleteByUidIn(List<String> uids);

  void deleteById(Long id);

}
