package com.acc.workspace.dto;

import jakarta.validation.constraints.Size;

public record UpdateWorkspaceRequest(
        @Size(max = 255, message = "Workspace name cannot exceed 255 characters")
        String name,

        String description,

        String planTier
) {}
