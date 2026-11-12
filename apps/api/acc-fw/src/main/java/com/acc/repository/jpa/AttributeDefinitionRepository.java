package com.acc.repository.jpa;

import com.acc.domain.metadata.AttributeDefinition;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttributeDefinitionRepository extends BaseRepository<AttributeDefinition> {
    Page<AttributeDefinition> findByEntityTypeId(Long entityTypeId, Pageable pageable);
    List<AttributeDefinition> findByEntityTypeId(Long entityTypeId);
    Page<AttributeDefinition> findByEntityTypeIdAndDeletedDateIsNull(Long entityTypeId, Pageable pageable);
    Page<AttributeDefinition> findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(Long entityTypeId, Pageable pageable);
    List<AttributeDefinition> findByEntityTypeIdAndDeletedDateIsNull(Long entityTypeId);
    List<AttributeDefinition> findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(Long entityTypeId);
    Optional<AttributeDefinition> findByIdAndDeletedDateIsNull(Long id);
    Optional<AttributeDefinition> findByEntityTypeIdAndIdAndDeletedDateIsNull(Long entityTypeId, Long id);
    boolean existsByEntityTypeIdAndSystemNameAndDeletedDateIsNull(Long entityTypeId, String systemName);
    List<AttributeDefinition> findAllByIdInAndEntityTypeIdAndDeletedDateIsNull(List<Long> ids, Long entityTypeId);
    List<AttributeDefinition> findByTenantIdAndDeletedDateIsNull(String tenantId);
    long countByTenantIdAndDeletedDateIsNull(String tenantId);
}
