package com.acc.tenant.billing.dto;

import lombok.Data;

@Data
public class PayOsWebhookPayload {
    private String code;
    private String desc;
    private PayOsWebhookData data;
    private String signature;

    @Data
    public static class PayOsWebhookData {
        private Long orderCode;
        private Long amount;
        private String description;
        private String accountNumber;
        private String reference;
        private String transactionDateTime;
        private String paymentLinkId;
        private String code;
        private String desc;
    }
}
