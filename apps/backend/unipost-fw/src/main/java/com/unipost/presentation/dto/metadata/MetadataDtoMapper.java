package com.unipost.presentation.dto.metadata;

import com.unipost.domain.metadata.AttributeDefinition;
import com.unipost.domain.metadata.EntityRecord;
import com.unipost.domain.metadata.EntityRelationship;
import com.unipost.domain.metadata.EntityType;
import com.unipost.domain.metadata.RelationshipType;

public final class MetadataDtoMapper {

    private MetadataDtoMapper() {}

    public static EntityTypeResponse toResponse(EntityType entityType) {
        if (entityType == null) return null;
        return new EntityTypeResponse(
                entityType.getId(),
                entityType.getUid(),
                entityType.getName(),
                entityType.getSystemName(),
                entityType.getDescription(),
                entityType.getSchemaVersion(),
                entityType.getVersion(),
                entityType.getCreatedDate(),
                entityType.getLastUpdatedDate(),
                entityType.getLifecycleConfig(),
                Boolean.TRUE.equals(entityType.getIsComposite()),
                entityType.getCompositeSpec()
        );
    }

    public static EntityType toEntity(CreateEntityTypeRequest request) {
        if (request == null) return null;
        EntityType entityType = new EntityType();
        entityType.setName(request.name().trim());
        entityType.setSystemName(request.systemName().trim());
        entityType.setDescription(request.description() != null ? request.description().trim() : null);
        entityType.setSchemaVersion(1L);
        entityType.setIsComposite(Boolean.TRUE.equals(request.isComposite()));
        entityType.setCompositeSpec(request.compositeSpec());
        return entityType;
    }

    public static AttributeDefinitionResponse toResponse(AttributeDefinition attr) {
        if (attr == null) return null;
        return new AttributeDefinitionResponse(
                attr.getId(),
                attr.getUid(),
                attr.getEntityType() != null ? attr.getEntityType().getId() : null,
                attr.getName(),
                attr.getSystemName(),
                attr.getDataType(),
                attr.getUiComponent(),
                attr.getIsRequired(),
                attr.getIsArchived(),
                attr.getDisplayOrder() != null ? attr.getDisplayOrder() : 0,
                attr.getOptions(),
                attr.getDefaultValue(),
                attr.getVersion(),
                attr.getCreatedDate(),
                attr.getLastUpdatedDate()
        );
    }

    public static AttributeDefinition toEntity(CreateAttributeRequest request, EntityType entityType) {
        if (request == null) return null;
        AttributeDefinition attr = new AttributeDefinition();
        attr.setEntityType(entityType);
        attr.setName(request.name().trim());
        attr.setSystemName(request.systemName().trim());
        attr.setDataType(request.dataType().trim().toLowerCase());
        attr.setUiComponent(request.uiComponent().trim().toLowerCase());
        attr.setIsRequired(Boolean.TRUE.equals(request.isRequired()));
        attr.setIsArchived(Boolean.TRUE.equals(request.isArchived()));
        attr.setDisplayOrder(0);
        attr.setOptions(request.options());
        attr.setDefaultValue(request.defaultValue());
        return attr;
    }

    public static EntityRecordResponse toResponse(EntityRecord record) {
        if (record == null) return null;
        java.util.Map<String, Object> redactedAttrs = com.unipost.service.metadata.serialization.FieldLevelSecuritySerializer
                .redactAttributesForCurrentContext(record.getAttributes());
        return new EntityRecordResponse(
                record.getId(),
                record.getUid(),
                record.getEntityType() != null ? record.getEntityType().getId() : null,
                record.getTenantId(),
                record.getSchemaVersion() != null ? record.getSchemaVersion() : 1L,
                redactedAttrs,
                record.getVersion(),
                record.getCreatedDate(),
                record.getLastUpdatedDate()
        );
    }

    public static EntityRecord toEntity(CreateRecordRequest request, EntityType entityType) {
        if (request == null) return null;
        EntityRecord record = new EntityRecord();
        record.setEntityType(entityType);
        record.setTenantId(request.tenantId());
        record.setSchemaVersion(entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L);
        record.setAttributes(request.attributes());
        return record;
    }

    public static RelationshipTypeResponse toResponse(RelationshipType type) {
        if (type == null) return null;
        return new RelationshipTypeResponse(
                type.getId(),
                type.getUid(),
                type.getSystemName(),
                type.getDescription(),
                type.getSourceEntityType() != null ? type.getSourceEntityType().getId() : null,
                type.getTargetEntityType() != null ? type.getTargetEntityType().getId() : null,
                type.getCardinality() != null ? type.getCardinality() : "MANY_TO_MANY",
                type.getVersion(),
                type.getCreatedDate(),
                type.getLastUpdatedDate()
        );
    }

    public static RelationshipType toEntity(CreateRelationshipTypeRequest request, EntityType source, EntityType target) {
        if (request == null) return null;
        RelationshipType type = new RelationshipType();
        type.setSystemName(request.systemName().trim());
        type.setDescription(request.description() != null ? request.description().trim() : null);
        type.setSourceEntityType(source);
        type.setTargetEntityType(target);
        type.setCardinality(request.cardinality() != null ? request.cardinality() : "MANY_TO_MANY");
        return type;
    }

    public static EntityRelationshipResponse toResponse(EntityRelationship rel) {
        if (rel == null) return null;
        return new EntityRelationshipResponse(
                rel.getId(),
                rel.getUid(),
                rel.getSourceEntity() != null ? rel.getSourceEntity().getId() : null,
                rel.getTargetEntity() != null ? rel.getTargetEntity().getId() : null,
                rel.getRelationshipType() != null ? rel.getRelationshipType().getId() : null,
                rel.getRelationshipType() != null ? rel.getRelationshipType().getSystemName() : null,
                rel.getEdgeMetadata(),
                rel.getVersion(),
                rel.getCreatedDate(),
                rel.getLastUpdatedDate()
        );
    }
}
