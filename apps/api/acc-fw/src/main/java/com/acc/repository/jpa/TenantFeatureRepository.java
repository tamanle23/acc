package com.acc.repository.jpa;

import com.acc.domain.billing.TenantFeature;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TenantFeatureRepository extends JpaRepository<TenantFeature, Long> {
    List<TenantFeature> findByTenantId(String tenantId);
    Optional<TenantFeature> findByTenantIdAndFeatureKey(String tenantId, String featureKey);
    void deleteByTenantId(String tenantId);
}
