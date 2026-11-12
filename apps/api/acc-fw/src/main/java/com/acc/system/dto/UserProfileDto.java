package com.acc.system.dto;

import java.io.Serializable;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * User personal profile details and UI preferences.
 * Returned by GET /api/v1/user/profile and updated via PUT /api/v1/user/profile.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserProfileDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String userId;
    private String username;
    private String firstName;
    private String lastName;
    private String email;
    private String phoneNumber;
    private Map<String, Object> preferences;
}
