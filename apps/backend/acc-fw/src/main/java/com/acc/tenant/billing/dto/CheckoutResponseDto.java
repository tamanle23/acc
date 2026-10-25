package com.acc.tenant.billing.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class CheckoutResponseDto {
    private Long orderCode;
    private Long amount;
    private String description;
    private String checkoutUrl;
    private String qrCode;
    private String status;
}
