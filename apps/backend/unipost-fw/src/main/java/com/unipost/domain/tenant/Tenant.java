package com.unipost.domain.tenant;

import com.unipost.domain.BaseModel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.Map;
import java.util.Objects;

@Entity
@Table(name = "UNIPOST_TENANTS")
@Getter
@Setter
public class Tenant extends BaseModel {

    @Column(name = "code", nullable = false, unique = true, length = 100)
    private String code;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "status", nullable = false, length = 50)
    private String status = "ACTIVE";

    @Column(name = "plan_tier", nullable = false, length = 50)
    private String planTier = "BASIC";

    @Column(name = "owner_user_uid")
    private String ownerUserUid;

    @Column(name = "region", length = 50)
    private String region = "ap-southeast-1";

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "metadata", columnDefinition = "jsonb")
    private Map<String, Object> metadata;

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Tenant tenant)) return false;
        return getId() != null && Objects.equals(getId(), tenant.getId());
    }

    @Override
    public int hashCode() {
        return getClass().hashCode();
    }
}
