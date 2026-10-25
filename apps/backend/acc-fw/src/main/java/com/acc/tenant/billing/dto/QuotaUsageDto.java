package com.acc.tenant.billing.dto;

import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class QuotaUsageDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private int workspacesUsed;
    private int maxWorkspaces; // -1 represents unlimited

    private int schemasUsed;
    private int maxSchemas; // -1 represents unlimited

    private long recordsUsed;
    private long maxRecords; // -1 represents unlimited
}
