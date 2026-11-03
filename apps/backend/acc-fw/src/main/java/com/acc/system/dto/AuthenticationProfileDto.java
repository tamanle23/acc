package com.acc.system.dto;

import java.io.Serializable;
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Strongly-typed session authentication and authorization profile.
 * Returned by GET /api/auth/me to hydrate client-side session state.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuthenticationProfileDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String username;
    private String tenantId;
    private boolean sovereign;
    private List<String> roles;
    private List<String> permissions;
    private List<String> activeFeatures;
}
