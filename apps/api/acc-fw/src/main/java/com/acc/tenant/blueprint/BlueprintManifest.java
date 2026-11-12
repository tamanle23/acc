package com.acc.tenant.blueprint;

import java.util.List;
import java.util.Map;

public record BlueprintManifest(
        String id,
        String name,
        String category,
        String description,
        String icon,
        List<BlueprintEntityType> entityTypes,
        List<BlueprintRelationship> relationshipTypes
) {
    public record BlueprintEntityType(
            String systemName,
            String name,
            String description,
            List<BlueprintAttribute> attributes
    ) {}

    public record BlueprintAttribute(
            String systemName,
            String name,
            String dataType,
            String uiComponent,
            Boolean isRequired,
            Integer displayOrder,
            String defaultValue,
            Map<String, Object> options
    ) {}

    public record BlueprintRelationship(
            String systemName,
            String name,
            String description,
            String sourceEntityType,
            String targetEntityType,
            String cardinality
    ) {}
}
