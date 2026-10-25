package com.acc.tenant.dto;

import java.util.List;

public record TenantProvisioningResult(
        String tenantId,
        String tenantName,
        String blueprintId,
        String blueprintName,
        int createdEntityTypesCount,
        int createdAttributesCount,
        int createdRelationshipsCount,
        List<String> createdEntityTypeNames,
        String defaultWorkspaceUid,
        String defaultWorkspaceName,
        long executionTimeMs
) {}
