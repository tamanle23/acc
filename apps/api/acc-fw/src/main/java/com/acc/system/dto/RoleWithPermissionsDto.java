package com.acc.system.dto;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleWithPermissionsDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String roleId;
    private String roleName;
    private String description;
    private boolean systemRole;
    private List<String> permissions;
    private List<String> inheritedRoles;
    private int userCount;
    private LocalDateTime createdDate;
}
