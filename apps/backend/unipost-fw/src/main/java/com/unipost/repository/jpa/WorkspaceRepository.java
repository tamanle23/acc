package com.unipost.repository.jpa;

import com.unipost.domain.workspace.Workspace;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface WorkspaceRepository extends BaseRepository<Workspace> {

    Optional<Workspace> findByIdAndDeletedDateIsNull(Long id);

    Optional<Workspace> findByUidAndDeletedDateIsNull(String uid);

    Optional<Workspace> findByTenantIdAndIsDefaultTrueAndDeletedDateIsNull(String tenantId);

    Optional<Workspace> findByTenantIdAndCodeAndDeletedDateIsNull(String tenantId, String code);

    List<Workspace> findByTenantIdAndDeletedDateIsNull(String tenantId);

    Page<Workspace> findByTenantIdAndDeletedDateIsNull(String tenantId, Pageable pageable);

    boolean existsByTenantIdAndCodeAndDeletedDateIsNull(String tenantId, String code);

    long countByTenantIdAndDeletedDateIsNull(String tenantId);
}
