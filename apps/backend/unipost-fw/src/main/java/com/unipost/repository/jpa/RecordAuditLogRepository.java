package com.unipost.repository.jpa;

import com.unipost.domain.metadata.RecordAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RecordAuditLogRepository extends JpaRepository<RecordAuditLog, RecordAuditLog.RecordAuditLogId> {

    List<RecordAuditLog> findByTenantIdAndRecordIdOrderByCreatedAtDesc(String tenantId, Long recordId);

    List<RecordAuditLog> findByTenantIdAndEntityTypeIdAndRecordIdOrderByCreatedAtDesc(String tenantId, Long entityTypeId, Long recordId);

    Optional<RecordAuditLog> findByTenantIdAndRecordIdAndId(String tenantId, Long recordId, Long id);

    Optional<RecordAuditLog> findByTenantIdAndEntityTypeIdAndRecordIdAndId(String tenantId, Long entityTypeId, Long recordId, Long id);
}
