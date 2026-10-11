package com.unipost.domain.workspace;

import com.unipost.domain.BaseModel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
@Entity
@Table(name = "UNIPOST_WORKSPACES")
public class Workspace extends BaseModel {

    private static final long serialVersionUID = 1L;

    @Column(name = "tenant_id", nullable = false)
    private String tenantId;

    @Column(nullable = false, length = 100)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(name = "plan_tier", nullable = false, length = 50)
    private String planTier = "STANDARD";

    @Column(name = "is_default", nullable = false)
    private Boolean isDefault = false;

    @Column(name = "is_immutable", nullable = false)
    private Boolean isImmutable = false;
}
