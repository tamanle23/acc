package com.unipost.domain.metadata;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import com.unipost.domain.BaseModel;

@Getter
@Setter
@Entity
@Table(name = "UNIPOST_ENTITY_TYPES")
public class EntityType extends BaseModel {

  @Column(nullable = false)
  private String name;

  @Column(name = "system_name", nullable = false)
  private String systemName;

  @Column(columnDefinition = "TEXT")
  private String description;

  @Column(name = "tenant_id", nullable = false)
  private String tenantId;

  @Column(name = "schema_version", nullable = false)
  private Long schemaVersion = 1L;

  @Column(name = "is_composite", nullable = false)
  private Boolean isComposite = false;

  @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
  @Column(name = "composite_spec", columnDefinition = "jsonb")
  private CompositeSpec compositeSpec;

  @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
  @Column(name = "lifecycle_config", columnDefinition = "jsonb")
  private LifecycleConfig lifecycleConfig;
}
