package com.acc.domain;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.MappedSuperclass;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreRemove;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Version;

import org.hibernate.annotations.DynamicInsert;
import org.hibernate.annotations.DynamicUpdate;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import com.fasterxml.jackson.annotation.JsonIgnore;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
@DynamicInsert
@DynamicUpdate
public abstract class BaseModel implements Serializable {

  private static final long serialVersionUID = 6096136186065185680L;

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  protected Long id;

  @Column(unique = true, updatable = false)
  protected String uid;

  @CreatedBy
  @Column(name = "createdBy_uid")
  protected String createdBy;

  // @CreatedDate
  @Column(precision = 3)
  protected LocalDateTime createdDate;

  @Column(name = "lastUpdatedBy_uid")
  @LastModifiedBy
  private String lastUpdatedBy;

  // @LastModifiedDate
  @Column(precision = 3)
  private LocalDateTime lastUpdatedDate;

  @Version
  private Long version;

  @JsonIgnore
  private LocalDateTime deletedDate;

  @PrePersist
  private void prePersist() {
    this.createdDate = LocalDateTime.now();
    this.lastUpdatedDate = this.createdDate;
    // this.uid = UUID.randomUUID().toString().replace("-", "");
    this.uid = UUID.randomUUID().toString();
  }

  @PreUpdate
  private void preUpdate() {
    this.lastUpdatedDate = LocalDateTime.now();
  }

  @PreRemove
  public void onPreRemove() {
  }
}
