package com.acc.system.dto;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DetailedTenantFleetDiagnosticsDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String tenantId;
    private String name;
    private String tier;
    private String status;
    private String billingCadence;
    private Long amountPaid;
    private LocalDateTime expiresAt;

    // Deep Quota Specs
    private int workspacesUsed;
    private int maxWorkspaces;
    private int schemasUsed;
    private int maxSchemas;
    private long recordsUsed;
    private long maxRecords;
    private int rateLimitCapacity;
    private long rateLimitSpikes;

    // System Telemetry
    private double cpuUsagePercent;
    private long memoryUsageBytes;
    private long storageBytes;
    private int activeConnections;
    private double avgQueryLatencyMs;

    // Feature Flags & Policies
    private List<String> activeFeatures;
    private Map<String, Object> metadataStats;
    private LocalDateTime createdDate;
    private LocalDateTime lastUpdatedDate;
}
