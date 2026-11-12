package com.acc.domain.metadata;

import com.acc.domain.BaseModel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;

@Getter
@Setter
@Entity
@Table(name = "UNIPOST_ATTRIBUTE_DEFINITIONS")
public class AttributeDefinition extends BaseModel {

    @ManyToOne
    @JoinColumn(name = "entity_type_id", nullable = false)
    private EntityType entityType;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(nullable = false)
    private String name;

    @Column(name = "system_name", nullable = false)
    private String systemName;

    @Column(name = "data_type", nullable = false)
    private String dataType;

    @Column(name = "ui_component", nullable = false)
    private String uiComponent;

    @Column(name = "is_required")
    private Boolean isRequired = false;

    @Column(name = "is_archived")
    private Boolean isArchived = false;

    @Column(name = "display_order")
    private Integer displayOrder = 0;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "options", columnDefinition = "jsonb")
    private Map<String, Object> options;

    @Column(name = "default_value")
    private String defaultValue;
}
