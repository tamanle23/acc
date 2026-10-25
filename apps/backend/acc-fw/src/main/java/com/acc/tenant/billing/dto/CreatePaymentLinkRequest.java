package com.acc.tenant.billing.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class CreatePaymentLinkRequest {
    @NotBlank
    private String planTier; // PRO, PRO_MAX

    @NotBlank
    private String cadence; // MONTHLY, YEARLY

    private String returnUrl;
    private String cancelUrl;
}
