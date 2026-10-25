package com.acc.presentation.dto.metadata;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;

public record CompositeRecordResponse(
        @JsonProperty("id") Long id,
        @JsonProperty("tenantId") String tenantId,
        @JsonProperty("entityTypeId") Long entityTypeId,
        @JsonProperty("isComposite") Boolean isComposite,
        @JsonProperty("schemaVersion") Long schemaVersion,
        @JsonProperty("attributes") Map<String, Object> attributes,
        @JsonProperty("childPagination") Map<String, ChildPaginationMetadata> childPagination,
        @JsonProperty("engineUsed") String engineUsed,
        @JsonProperty("createdDate") LocalDateTime createdDate,
        @JsonProperty("updatedDate") LocalDateTime updatedDate
) implements Serializable {}
