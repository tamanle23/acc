package com.acc.domain.billing;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "UNIPOST_TENANT_BILLING")
public class TenantBilling implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(name = "payos_customer_id")
    private String payosCustomerId;

    @Column(name = "current_order_code")
    private Long currentOrderCode;

    @Column(name = "payment_provider", nullable = false)
    private String paymentProvider = "PAYOS";

    @Column(name = "provider_customer_ref")
    private String providerCustomerRef;

    @Column(name = "current_order_ref")
    private String currentOrderRef;

    @Column(name = "currency", nullable = false)
    private String currency = "VND";

    @org.hibernate.annotations.JdbcTypeCode(org.hibernate.type.SqlTypes.JSON)
    @Column(name = "billing_metadata", columnDefinition = "jsonb")
    private java.util.Map<String, Object> billingMetadata = new java.util.HashMap<>();

    @Column(name = "plan_tier", nullable = false)
    private String planTier = "BASIC";

    @Column(name = "billing_cadence", nullable = false)
    private String billingCadence = "MONTHLY";

    @Column(name = "status", nullable = false)
    private String status = "ACTIVE";

    @Column(name = "amount_paid")
    private Long amountPaid = 0L;

    @Column(name = "expires_at")
    private LocalDateTime expiresAt;

    @Column(name = "created_date")
    private LocalDateTime createdDate;

    @Column(name = "last_updated_date")
    private LocalDateTime lastUpdatedDate;

    @PrePersist
    public void onPrePersist() {
        if (createdDate == null) {
            createdDate = LocalDateTime.now();
        }
        lastUpdatedDate = LocalDateTime.now();
    }

    @PreUpdate
    public void onPreUpdate() {
        lastUpdatedDate = LocalDateTime.now();
    }
}
