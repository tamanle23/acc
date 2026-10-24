package com.unipost.user.model;

import java.time.LocalDateTime;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;

import org.springframework.data.jpa.domain.Specification;

public class UserPermissionSearchCriteria extends UserPermission implements Specification<UserPermission> {

  private static final long serialVersionUID = 426622043872600271L;

  @Override
  public Predicate toPredicate(Root<UserPermission> root, CriteriaQuery<?> criteriaquery, CriteriaBuilder criteriaBuilder) {
    Predicate predicate = criteriaBuilder.isNull(root.<LocalDateTime>get("deletedDate"));
    return predicate;
  }
}
