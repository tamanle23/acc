package com.unipost.repository.jpa;

import com.unipost.domain.metadata.EntityRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EntityRecordRepository extends BaseRepository<EntityRecord> {
    Page<EntityRecord> findByEntityTypeId(Long entityTypeId, Pageable pageable);
    List<EntityRecord> findByEntityTypeId(Long entityTypeId);
    Page<EntityRecord> findByEntityTypeIdAndDeletedDateIsNull(Long entityTypeId, Pageable pageable);
    List<EntityRecord> findByEntityTypeIdAndDeletedDateIsNull(Long entityTypeId);
    Page<EntityRecord> findByEntityTypeIdAndTenantIdAndDeletedDateIsNull(Long entityTypeId, String tenantId, Pageable pageable);
    List<EntityRecord> findByEntityTypeIdAndTenantIdAndDeletedDateIsNull(Long entityTypeId, String tenantId);
    Optional<EntityRecord> findByIdAndDeletedDateIsNull(Long id);
    Optional<EntityRecord> findByEntityTypeIdAndIdAndDeletedDateIsNull(Long entityTypeId, Long id);
    boolean existsByEntityTypeIdAndDeletedDateIsNull(Long entityTypeId);
    long countByEntityTypeIdAndSchemaVersionLessThanAndDeletedDateIsNull(Long entityTypeId, Long schemaVersion);
    Page<EntityRecord> findByEntityTypeIdAndSchemaVersionLessThanAndDeletedDateIsNull(Long entityTypeId, Long schemaVersion, Pageable pageable);

    List<EntityRecord> findByTenantIdAndDeletedDateIsNull(String tenantId);
    Page<EntityRecord> findByTenantIdAndDeletedDateIsNull(String tenantId, Pageable pageable);
    long countByTenantIdAndDeletedDateIsNull(String tenantId);
}
