package com.acc.presentation.dto.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.util.Collections;
import java.util.Map;

public record ChildQueryOptions(
    @JsonProperty("limit")
    Integer limit,

    @JsonProperty("offset")
    Integer offset,

    @JsonProperty("sort")
    String sort,

    @JsonProperty("filters")
    Map<String, Object> filters
) implements Serializable {

    public static final int DEFAULT_LIMIT = 50;
    public static final int DEFAULT_OFFSET = 0;

    public int effectiveLimit() {
        return (limit != null && limit > 0) ? limit : DEFAULT_LIMIT;
    }

    public int effectiveOffset() {
        return (offset != null && offset >= 0) ? offset : DEFAULT_OFFSET;
    }

    public Map<String, Object> effectiveFilters() {
        return filters != null ? filters : Collections.emptyMap();
    }
}
