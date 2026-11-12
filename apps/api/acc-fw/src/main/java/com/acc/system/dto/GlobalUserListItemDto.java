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
public class GlobalUserListItemDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String username;
    private String email;
    private String displayName;
    private String tenantId;
    private List<String> roles;
    private boolean locked;
    private boolean active;
    private LocalDateTime lastLoginDate;
    private LocalDateTime createdDate;
}
