package com.acc.tenant.billing.dto;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TenantBillingSummaryDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private String tenantId;
    private String planTier;
    private String billingCadence;
    private String status;
    private Long amountPaid;
    private LocalDateTime expiresAt;
    private Set<String> entitledFeatures;

    private QuotaUsageDto quotas;
    private VatInvoiceDto vatInvoice;
    private List<BillingTransactionDto> history;
}
