package com.acc.repository.jpa;

import com.acc.domain.metadata.EntityRelationship;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface EntityRelationshipRepository extends BaseRepository<EntityRelationship> {
    Optional<EntityRelationship> findByIdAndDeletedDateIsNull(Long id);

    boolean existsByRelationshipTypeIdAndDeletedDateIsNull(Long relationshipTypeId);

    boolean existsBySourceEntityIdAndTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(
            Long sourceEntityId, Long targetEntityId, Long relationshipTypeId);

    long countBySourceEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(
            Long sourceEntityId, Long relationshipTypeId);

    long countByTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(
            Long targetEntityId, Long relationshipTypeId);

    Page<EntityRelationship> findBySourceEntityIdAndDeletedDateIsNull(Long sourceEntityId, Pageable pageable);

    Page<EntityRelationship> findByTargetEntityIdAndDeletedDateIsNull(Long targetEntityId, Pageable pageable);

    Page<EntityRelationship> findBySourceEntityIdOrTargetEntityIdAndDeletedDateIsNull(
            Long sourceEntityId, Long targetEntityId, Pageable pageable);

    List<EntityRelationship> findBySourceEntityIdAndDeletedDateIsNull(Long sourceEntityId);

    List<EntityRelationship> findByTargetEntityIdAndDeletedDateIsNull(Long targetEntityId);

    List<EntityRelationship> findByTenantIdAndDeletedDateIsNull(String tenantId);
    Page<EntityRelationship> findByTenantIdAndDeletedDateIsNull(String tenantId, Pageable pageable);
    long countByTenantIdAndDeletedDateIsNull(String tenantId);
}
