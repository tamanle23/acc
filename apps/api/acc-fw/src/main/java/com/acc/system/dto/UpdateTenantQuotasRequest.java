package com.acc.system.dto;

import jakarta.validation.constraints.NotBlank;
import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateTenantQuotasRequest implements Serializable {

    private static final long serialVersionUID = 1L;

    /**
     * Max allowed workspaces. -1 indicates unlimited.
     */
    private Integer maxWorkspaces;

    /**
     * Max allowed entity types / schemas. -1 indicates unlimited.
     */
    private Integer maxSchemas;

    /**
     * Max allowed records across all schemas. -1 indicates unlimited.
     */
    private Long maxRecords;

    /**
     * Token bucket capacity per minute.
     */
    private Integer rateLimitBurst;

    /**
     * Token refill rate per second.
     */
    private Integer rateLimitReplenishRate;

    @NotBlank(message = "reason is required for quota changes")
    private String reason;
}
