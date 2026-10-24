package com.unipost.identity.domain.user.repository;

import com.unipost.user.model.Permission;
import java.util.Optional;
import java.util.List;

public interface PermissionRepository {
    Permission save(Permission permission);
    Optional<Permission> findById(Long id);
    Optional<Permission> findByName(String name);
    List<Permission> findAll();
}
