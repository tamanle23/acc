package com.acc.presentation.dto.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;

public record ChildPaginationMetadata(
        @JsonProperty("totalElements") long totalElements,
        @JsonProperty("limit") int limit,
        @JsonProperty("offset") int offset,
        @JsonProperty("hasMore") boolean hasMore
) implements Serializable {}
