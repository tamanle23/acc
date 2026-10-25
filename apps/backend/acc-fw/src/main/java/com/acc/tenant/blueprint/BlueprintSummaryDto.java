package com.acc.tenant.blueprint;

public record BlueprintSummaryDto(
        String id,
        String name,
        String category,
        String description,
        String icon,
        int entityTypesCount,
        int relationshipTypesCount
) {
    public static BlueprintSummaryDto from(BlueprintManifest manifest) {
        return new BlueprintSummaryDto(
                manifest.id(),
                manifest.name(),
                manifest.category(),
                manifest.description(),
                manifest.icon(),
                manifest.entityTypes() != null ? manifest.entityTypes().size() : 0,
                manifest.relationshipTypes() != null ? manifest.relationshipTypes().size() : 0
        );
    }
}
