package com.unipost.workflow.core.model;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public record WorkflowAuditRecord(
    long sequenceNum,
    String eventId,
    String workflowId,
    String tenantId,
    String actorId,
    String action,
    Map<String, Object> payloadSnapshot,
    String prevHash,
    String currentHash,
    long createdAtMs
) {
    public static final String GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

    public WorkflowAuditRecord {
        if (eventId == null || eventId.isBlank()) {
            throw new IllegalArgumentException("eventId is required");
        }
        if (workflowId == null || workflowId.isBlank()) {
            throw new IllegalArgumentException("workflowId is required");
        }
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = "system";
        }
        if (actorId == null || actorId.isBlank()) {
            actorId = "SYSTEM";
        }
        if (action == null || action.isBlank()) {
            throw new IllegalArgumentException("action is required");
        }
        if (prevHash == null || prevHash.isBlank()) {
            prevHash = GENESIS_HASH;
        }
        if (currentHash == null || currentHash.isBlank()) {
            throw new IllegalArgumentException("currentHash is required");
        }
    }
}
