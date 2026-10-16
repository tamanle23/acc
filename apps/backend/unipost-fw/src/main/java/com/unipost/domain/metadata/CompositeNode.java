package com.unipost.domain.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.util.List;

public record CompositeNode(
    @JsonProperty("target_entity_type_id")
    Long targetEntityTypeId,

    @JsonProperty("target_entity_system_name")
    String targetEntitySystemName,

    @JsonProperty("alias")
    String alias,

    @JsonProperty("join_pattern")
    CompositeJoinPattern joinPattern,

    @JsonProperty("foreign_key_attribute")
    String foreignKeyAttribute,

    @JsonProperty("relationship_type_id")
    Long relationshipTypeId,

    @JsonProperty("cardinality")
    String cardinality,

    @JsonProperty("fields")
    List<CompositeField> fields,

    @JsonProperty("children")
    List<CompositeNode> children,

    @JsonProperty("rollups")
    List<CompositeRollup> rollups
) implements Serializable {

    public CompositeNode(
            Long targetEntityTypeId,
            String targetEntitySystemName,
            String alias,
            CompositeJoinPattern joinPattern,
            String foreignKeyAttribute,
            Long relationshipTypeId,
            String cardinality,
            List<CompositeField> fields,
            List<CompositeNode> children) {
        this(targetEntityTypeId, targetEntitySystemName, alias, joinPattern, foreignKeyAttribute, relationshipTypeId, cardinality, fields, children, List.of());
    }

    public String effectiveAlias() {
        if (alias != null && !alias.isBlank()) {
            return alias.trim();
        }
        return (targetEntitySystemName != null && !targetEntitySystemName.isBlank()) 
            ? targetEntitySystemName.toLowerCase() 
            : "node_" + targetEntityTypeId;
    }

    public CompositeJoinPattern effectiveJoinPattern() {
        return joinPattern != null ? joinPattern : CompositeJoinPattern.PATTERN_B_FOREIGN_KEY;
    }
}
