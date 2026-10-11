package com.unipost.system.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;
import java.util.List;

/**
 * Request payload for provisioning a new custom RBAC role with declarative DAG inheritance.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateRoleRequest implements Serializable {

    @NotBlank(message = "Role ID must not be blank")
    @Pattern(regexp = "^ROLE_[A-Z0-9_]+$", message = "Role ID must follow format ROLE_<UPPERCASE_IDENTIFIER>")
    private String roleId;

    @NotBlank(message = "Role display name must not be blank")
    private String roleName;

    private String description;

    @Builder.Default
    private List<String> permissions = List.of();

    @Builder.Default
    private List<String> inheritedRoles = List.of("ROLE_USER");
}
