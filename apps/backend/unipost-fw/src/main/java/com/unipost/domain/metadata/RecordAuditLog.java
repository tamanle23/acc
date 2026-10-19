package com.unipost.domain.metadata;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.io.Serializable;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.Objects;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "UNIPOST_RECORD_AUDIT_LOG")
@IdClass(RecordAuditLog.RecordAuditLogId.class)
public class RecordAuditLog implements Serializable {

    private static final long serialVersionUID = 1L;

    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "seq_unipost_record_audit_log")
    @SequenceGenerator(name = "seq_unipost_record_audit_log", sequenceName = "seq_unipost_record_audit_log", allocationSize = 1)
    @Column(name = "id")
    private Long id;

    @Id
    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "tenant_id", nullable = false, length = 64)
    private String tenantId;

    @Column(name = "record_id", nullable = false)
    private Long recordId;

    @Column(name = "entity_type_id", nullable = false)
    private Long entityTypeId;

    @Column(name = "operation", nullable = false, length = 16)
    private String operation; // CREATE, UPDATE, SOFT_DELETE, RESTORE

    @Column(name = "actor", nullable = false, length = 64)
    private String actor;

    @Column(name = "version", nullable = false)
    private Long version;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "old_attributes", columnDefinition = "jsonb")
    private Map<String, Object> oldAttributes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "new_attributes", columnDefinition = "jsonb")
    private Map<String, Object> newAttributes;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "delta", columnDefinition = "jsonb")
    private Map<String, Object> delta;

    @PrePersist
    public void prePersist() {
        if (this.createdAt == null) {
            this.createdAt = LocalDateTime.now();
        }
    }

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecordAuditLogId implements Serializable {
        private static final long serialVersionUID = 1L;
        private Long id;
        private LocalDateTime createdAt;

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            RecordAuditLogId that = (RecordAuditLogId) o;
            return Objects.equals(id, that.id) && Objects.equals(createdAt, that.createdAt);
        }

        @Override
        public int hashCode() {
            return Objects.hash(id, createdAt);
        }
    }
}
