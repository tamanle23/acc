package com.unipost.workspace.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateWorkspaceRequest(
        @NotBlank(message = "Workspace code cannot be blank")
        @Size(max = 100, message = "Workspace code cannot exceed 100 characters")
        @Pattern(regexp = "^[a-zA-Z0-9_-]+$", message = "Workspace code must contain only alphanumeric characters, dashes, or underscores")
        String code,

        @NotBlank(message = "Workspace name cannot be blank")
        @Size(max = 255, message = "Workspace name cannot exceed 255 characters")
        String name,

        String description,

        String planTier
) {}
