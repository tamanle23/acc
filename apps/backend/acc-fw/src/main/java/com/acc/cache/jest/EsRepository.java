package com.acc.cache.jest;

import java.util.Collection;
import java.util.List;
import java.util.Map;

public interface EsRepository<T, ID> {

  void save(T object);

  void save(List<T> objects);

  void saveWithoutRefresh(List<T> objects);

  boolean partiallyUpdate(ID id, T object);

  boolean partiallyUpdate(Map<ID, T> objectsMap);

  T findById(ID id);

  List<T> findAll(Collection<ID> ids);

  String getIndexName();
}
