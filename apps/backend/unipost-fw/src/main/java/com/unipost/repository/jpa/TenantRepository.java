package com.unipost.repository.jpa;

import com.unipost.domain.tenant.Tenant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TenantRepository extends JpaRepository<Tenant, Long> {

    Optional<Tenant> findByCodeAndDeletedDateIsNull(String code);

    boolean existsByCodeAndDeletedDateIsNull(String code);
}
