package com.acc.fs.infrastructure.adapters.outbound.persistence;

import com.acc.fs.domain.model.FsObjectAggregate;
import com.acc.fs.domain.model.valobj.FileId;
import com.acc.fs.domain.repository.FsObjectRepositoryPort;
import com.acc.fs.infrastructure.adapters.outbound.persistence.mybatis.FsObjectMyBatisMapper;
import org.springframework.stereotype.Repository;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Production Outbound Persistence Adapter for FsObjects using MyBatis.
 */
@Repository("myBatisFsObjectRepositoryAdapter")
public class MyBatisFsObjectRepositoryAdapter implements FsObjectRepositoryPort {

    private final FsObjectMyBatisMapper mapper;

    public MyBatisFsObjectRepositoryAdapter(FsObjectMyBatisMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void save(FsObjectAggregate aggregate) {
        if (aggregate == null) return;
        mapper.upsertFsObject(aggregate);
        if (aggregate.parentUid() != null && !aggregate.parentUid().isBlank()) {
            mapper.insertRelation(aggregate.parentUid(), aggregate.getId().value(), aggregate.tenantId());
        }
    }

    @Override
    public Optional<FsObjectAggregate> findById(FileId id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(mapper.selectById(id.value()));
    }

    @Override
    public List<FsObjectAggregate> findAllByParentUid(String tenantId, String parentUid) {
        if (parentUid == null || parentUid.isBlank()) {
            return Collections.emptyList();
        }
        return mapper.selectAllByParentUid(tenantId, parentUid);
    }

    @Override
    public List<FsObjectAggregate> findAllDirectories(String tenantId, String parentUid) {
        return mapper.selectAllDirectories(tenantId, parentUid);
    }

    @Override
    public void deleteById(FileId id) {
        if (id == null) return;
        mapper.deleteById(id.value());
    }
}
