package com.acc.tenant.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record TenantProvisioningRequest(
        @NotBlank(message = "tenantId is required")
        @Pattern(regexp = "^[a-z0-9_-]{3,64}$", message = "tenantId must be 3-64 characters containing lowercase letters, numbers, hyphens or underscores")
        String tenantId,

        @NotBlank(message = "tenantName is required")
        @Size(max = 255, message = "tenantName must not exceed 255 characters")
        String tenantName,

        @NotBlank(message = "blueprintId is required")
        String blueprintId
) {}
