package com.acc.system.dto;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AssumeTenantRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * Requested session duration in minutes (default 60, max 480).
     */
    @Builder.Default
    private int durationMinutes = 60;

    private String reason;
}
