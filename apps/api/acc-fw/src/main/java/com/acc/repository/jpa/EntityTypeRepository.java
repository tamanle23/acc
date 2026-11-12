package com.acc.repository.jpa;

import com.acc.domain.metadata.EntityType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface EntityTypeRepository extends BaseRepository<EntityType> {
    Optional<EntityType> findByIdAndDeletedDateIsNull(Long id);
    Optional<EntityType> findBySystemNameAndDeletedDateIsNull(String systemName);
    Optional<EntityType> findByTenantIdAndSystemNameAndDeletedDateIsNull(String tenantId, String systemName);
    boolean existsBySystemNameAndDeletedDateIsNull(String systemName);
    Page<EntityType> findAllByDeletedDateIsNull(Pageable pageable);
    java.util.List<EntityType> findAllByDeletedDateIsNull();
    long countByDeletedDateIsNull();
    java.util.List<EntityType> findByTenantIdAndDeletedDateIsNull(String tenantId);
    long countByTenantIdAndDeletedDateIsNull(String tenantId);
}
