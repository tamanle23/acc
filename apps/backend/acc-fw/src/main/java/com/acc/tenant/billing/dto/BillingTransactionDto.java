package com.acc.tenant.billing.dto;

import java.io.Serializable;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BillingTransactionDto implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long orderCode;
    private Long amount;
    private String planTier;
    private String billingCadence;
    private String status;
    private String description;
    private LocalDateTime createdAt;
    private LocalDateTime paidAt;
}
