package com.acc.system.dto;

import jakarta.validation.constraints.NotEmpty;
import java.io.Serializable;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateRolePermissionsRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    @NotEmpty(message = "permissions list must not be empty")
    private List<String> permissions;

    private List<String> inheritedRoles;

    private String reason;
}
