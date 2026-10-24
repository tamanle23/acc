package com.unipost.identity.infra.user.repository;

import com.unipost.identity.domain.user.repository.PermissionRepository;
import com.unipost.user.model.Permission;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

@Repository("domainPermissionRepositoryImpl")
public class PermissionRepositoryImpl implements PermissionRepository {

    private final com.unipost.identity.infra.user.repository.jpa.PermissionRepository jpaRepository;

    public PermissionRepositoryImpl(com.unipost.identity.infra.user.repository.jpa.PermissionRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Permission save(Permission permission) {
        return jpaRepository.save(permission);
    }

    @Override
    public Optional<Permission> findById(Long id) {
        return jpaRepository.findById(id);
    }

    @Override
    public Optional<Permission> findByName(String name) {
        // Since there is no explicit findByName/Code, we skip it for now in PoC or use default repo behavior
        return Optional.empty();
    }

    @Override
    public List<Permission> findAll() {
        return jpaRepository.findAll();
    }
}
