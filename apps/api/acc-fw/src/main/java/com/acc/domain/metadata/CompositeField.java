package com.acc.domain.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;

public record CompositeField(
    @JsonProperty("source_attribute")
    String sourceAttribute,

    @JsonProperty("alias")
    String alias,

    @JsonProperty("data_type")
    String dataType,

    @JsonProperty("default_value")
    Object defaultValue,

    @JsonProperty("required")
    Boolean required
) implements Serializable {

    public String effectiveAlias() {
        return (alias != null && !alias.isBlank()) ? alias.trim() : sourceAttribute;
    }
}
