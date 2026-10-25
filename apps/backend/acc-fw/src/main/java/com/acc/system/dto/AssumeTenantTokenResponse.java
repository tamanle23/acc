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
public class AssumeTenantTokenResponse implements Serializable {

    private static final long serialVersionUID = 1L;

    private String ephemeralToken;
    private String actorTenantId;
    private String effectiveTenantId;
    private LocalDateTime issuedAt;
    private LocalDateTime expiresAt;
    private List<String> authorities;
    private String message;
}
