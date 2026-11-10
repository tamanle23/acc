package com.acc.identity.infra.user.repository;

import com.acc.identity.domain.user.model.UserAggregate;
import com.acc.identity.domain.user.repository.UserRepositoryPort;
import com.acc.identity.domain.user.valobj.UserId;
import com.acc.identity.domain.user.valobj.UserStatus;
import com.acc.identity.infra.user.repository.mybatis.UserMyBatisMapper;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/**
 * Production Secondary Outbound Adapter for User Persistence using MyBatis.
 * Annotated with @Primary to satisfy UserRepositoryPort injection.
 */
@Primary
@Repository("myBatisUserRepositoryAdapter")
public class MyBatisUserRepositoryAdapter implements UserRepositoryPort {

    private final UserMyBatisMapper mapper;

    public MyBatisUserRepositoryAdapter(UserMyBatisMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void save(UserAggregate user) {
        mapper.upsertUser(user);
    }

    @Override
    public Optional<UserAggregate> findById(UserId id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(mapper.selectById(id.value()));
    }

    @Override
    public Optional<UserAggregate> findByEmail(String tenantId, String email) {
        if (email == null) return Optional.empty();
        return Optional.ofNullable(mapper.selectByEmail(tenantId, email));
    }

    @Override
    public Optional<UserAggregate> findByUsername(String tenantId, String username) {
        if (username == null) return Optional.empty();
        return Optional.ofNullable(mapper.selectByUsername(tenantId, username));
    }

    @Override
    public boolean existsByEmail(String tenantId, String email) {
        if (email == null) return false;
        return mapper.countByEmail(tenantId, email) > 0;
    }

    @Override
    public boolean existsByUsername(String tenantId, String username) {
        if (username == null) return false;
        return mapper.countByUsername(tenantId, username) > 0;
    }

    @Override
    public void updateStatus(UserId id, UserStatus status, long nowEpochMs) {
        if (id != null && status != null) {
            mapper.updateStatus(id.value(), status.name(), nowEpochMs);
        }
    }
}
