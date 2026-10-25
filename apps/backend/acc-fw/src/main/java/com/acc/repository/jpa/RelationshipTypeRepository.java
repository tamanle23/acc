package com.acc.repository.jpa;

import com.acc.domain.metadata.RelationshipType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RelationshipTypeRepository extends BaseRepository<RelationshipType> {
    Optional<RelationshipType> findByIdAndDeletedDateIsNull(Long id);
    boolean existsBySystemNameAndDeletedDateIsNull(String systemName);
    Page<RelationshipType> findAllByDeletedDateIsNull(Pageable pageable);
    java.util.List<RelationshipType> findByTenantIdAndDeletedDateIsNull(String tenantId);
    long countByTenantIdAndDeletedDateIsNull(String tenantId);
}
