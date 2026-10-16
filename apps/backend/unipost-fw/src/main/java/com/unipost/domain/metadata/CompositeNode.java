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
    List<CompositeNode> children
) implements Serializable {

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
