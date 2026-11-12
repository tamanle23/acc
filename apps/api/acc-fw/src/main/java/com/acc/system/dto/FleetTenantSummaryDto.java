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
public class FleetTenantSummaryDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String tenantId;
    private String name;
    private String slug;
    private String tier; // BASIC, PRO, PRO_MAX, ENTERPRISE
    private String status; // ACTIVE, SUSPENDED, ARCHIVED
    private String ownerEmail;

    // Telemetry & Usage
    private int workspacesCount;
    private int maxWorkspaces;
    private int schemasCount;
    private int maxSchemas;
    private long recordsCount;
    private long maxRecords;

    // Live health & runtime counters
    private double cpuUsagePercent;
    private long storageBytes;
    private long rateLimitSpikes;
    private int activeConnections;

    private LocalDateTime expiresAt;
    private LocalDateTime createdDate;
    private LocalDateTime lastUpdatedDate;
    private List<String> activeFeatures;
}
