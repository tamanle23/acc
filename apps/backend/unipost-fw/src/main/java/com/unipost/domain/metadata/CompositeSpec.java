package com.unipost.domain.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.util.List;

public record CompositeSpec(
    @JsonProperty("root_entity_type_id")
    Long rootEntityTypeId,

    @JsonProperty("root_entity_system_name")
    String rootEntitySystemName,

    @JsonProperty("root_alias")
    String rootAlias,

    @JsonProperty("fields")
    List<CompositeField> fields,

    @JsonProperty("children")
    List<CompositeNode> children,

    @JsonProperty("rollups")
    List<CompositeRollup> rollups
) implements Serializable {

    public CompositeSpec(
            Long rootEntityTypeId,
            String rootEntitySystemName,
            String rootAlias,
            List<CompositeField> fields,
            List<CompositeNode> children) {
        this(rootEntityTypeId, rootEntitySystemName, rootAlias, fields, children, List.of());
    }

    public String effectiveRootAlias() {
        if (rootAlias != null && !rootAlias.isBlank()) {
            return rootAlias.trim();
        }
        return (rootEntitySystemName != null && !rootEntitySystemName.isBlank()) 
            ? rootEntitySystemName.toLowerCase() 
            : "root";
    }
}
