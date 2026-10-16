package com.unipost.domain.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;

public record CompositeRollup(
    @JsonProperty("alias")
    String alias,

    @JsonProperty("target_node_alias")
    String targetNodeAlias,

    @JsonProperty("aggregate_function")
    AggregateFunction aggregateFunction,

    @JsonProperty("target_field")
    String targetField,

    @JsonProperty("filter_predicate")
    String filterPredicate
) implements Serializable {

    public enum AggregateFunction {
        SUM,
        COUNT,
        AVG,
        MIN,
        MAX
    }

    public String effectiveAlias() {
        if (alias != null && !alias.isBlank()) {
            return alias.trim();
        }
        return (aggregateFunction != null ? aggregateFunction.name().toLowerCase() : "agg")
            + "_" + (targetField != null ? targetField : targetNodeAlias);
    }
}
