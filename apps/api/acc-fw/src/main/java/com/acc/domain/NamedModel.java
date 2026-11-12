package com.acc.domain;

import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.DynamicInsert;
import org.hibernate.annotations.DynamicUpdate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import jakarta.persistence.*;

@Getter
@Setter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@DynamicInsert
@DynamicUpdate
public abstract class NamedModel extends BaseModel {

  @Column(unique = false, length = 50)
  protected String code;

  @Column(length = 200)
  protected String description;
}
