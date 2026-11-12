package com.acc.domain;

import java.util.List;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;

import org.hibernate.Hibernate;
import org.springframework.stereotype.Component;

@Component
public class JpaHelpers {

  @PersistenceContext
  private EntityManager entityManager;

  public void flushAndClear() {
    entityManager.flush();
    entityManager.clear();
  }

  public void initialize(Object obj) {
    Hibernate.initialize(obj);
  }

  public boolean isManaged(Object entity) {
    return this.entityManager.contains(entity);
  }

  public void detach(List<?> entities) {
    entities.forEach(entityManager::detach);
  }
}
