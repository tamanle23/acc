package com.unipost.identity.infra.user.repository;

import com.unipost.identity.domain.user.repository.RoleRepository;
import com.unipost.user.model.Role;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository("domainRoleRepositoryImpl")
public class RoleRepositoryImpl implements RoleRepository {

    private final com.unipost.identity.infra.user.repository.jpa.RoleRepository jpaRepository;

    public RoleRepositoryImpl(com.unipost.identity.infra.user.repository.jpa.RoleRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Role save(Role role) {
        return jpaRepository.save(role);
    }

    @Override
    public Optional<Role> findById(Long id) {
        return jpaRepository.findById(id);
    }

    @Override
    public Optional<Role> findByName(String name) {
        return Optional.ofNullable(jpaRepository.findOneByCodeIgnoreCase(name));
    }

    @Override
    public boolean existsByName(String name) {
        return jpaRepository.findOneByCodeIgnoreCase(name) != null;
    }

    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }
}
