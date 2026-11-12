package com.acc.repository.jpa;

import com.acc.domain.metadata.RecordAuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

@Repository
public interface RecordAuditLogRepository extends JpaRepository<RecordAuditLog, RecordAuditLog.RecordAuditLogId> {

    List<RecordAuditLog> findByTenantIdAndRecordIdOrderByCreatedAtDesc(String tenantId, Long recordId);

    List<RecordAuditLog> findByTenantIdAndEntityTypeIdAndRecordIdOrderByCreatedAtDesc(String tenantId, Long entityTypeId, Long recordId);

    Optional<RecordAuditLog> findByTenantIdAndRecordIdAndId(String tenantId, Long recordId, Long id);

    Optional<RecordAuditLog> findByTenantIdAndEntityTypeIdAndRecordIdAndId(String tenantId, Long entityTypeId, Long recordId, Long id);

    Optional<RecordAuditLog> findTopByTenantIdOrderByIdDesc(String tenantId);

    List<RecordAuditLog> findByTenantIdAndIdBetweenOrderByIdAsc(String tenantId, Long fromId, Long toId);

    @Query("SELECT r FROM RecordAuditLog r WHERE (:tenantId = 'SYSTEM' OR r.tenantId = :tenantId) " +
           "AND (:operation IS NULL OR r.operation = :operation) " +
           "AND (:actor IS NULL OR LOWER(r.actor) LIKE LOWER(CONCAT('%', :actor, '%'))) " +
           "ORDER BY r.id DESC")
    Page<RecordAuditLog> findFilteredAuditLogs(
            @Param("tenantId") String tenantId,
            @Param("operation") String operation,
            @Param("actor") String actor,
            Pageable pageable);
}
