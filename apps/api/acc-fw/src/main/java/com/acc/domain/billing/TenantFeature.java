package com.acc.domain.billing;

import jakarta.persistence.*;
import java.io.Serializable;
import java.time.LocalDateTime;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "UNIPOST_TENANT_FEATURES")
public class TenantFeature implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(name = "feature_key", nullable = false)
    private String featureKey;

    @Column(name = "is_enabled", nullable = false)
    private Boolean isEnabled = true;

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
