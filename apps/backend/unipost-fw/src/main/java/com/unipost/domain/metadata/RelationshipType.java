package com.unipost.domain.metadata;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import com.unipost.domain.BaseModel;

@Getter
@Setter
@Entity
@Table(name = "UNIPOST_RELATIONSHIP_TYPES")
public class RelationshipType extends BaseModel {

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(name = "system_name", nullable = false)
    private String systemName;

    @Column(columnDefinition = "TEXT")
    private String description;

    @ManyToOne
    @JoinColumn(name = "source_entity_type_id")
    private EntityType sourceEntityType;

    @ManyToOne
    @JoinColumn(name = "target_entity_type_id")
    private EntityType targetEntityType;

    @Column(name = "cardinality", length = 50)
    private String cardinality;
}
