package com.acc.identity.domain.user.repository;

import com.acc.identity.domain.user.model.UserAggregate;
import com.acc.identity.domain.user.valobj.UserId;
import com.acc.identity.domain.user.valobj.UserStatus;

import java.util.Optional;

/**
 * Secondary Driven Port (SPI) for user persistence.
 * Zero framework annotations. Pure domain aggregate models.
 */
public interface UserRepositoryPort {

    void save(UserAggregate user);

    Optional<UserAggregate> findById(UserId id);

    Optional<UserAggregate> findByEmail(String tenantId, String email);

    Optional<UserAggregate> findByUsername(String tenantId, String username);

    boolean existsByEmail(String tenantId, String email);

    boolean existsByUsername(String tenantId, String username);

    void updateStatus(UserId id, UserStatus status, long nowEpochMs);
}
