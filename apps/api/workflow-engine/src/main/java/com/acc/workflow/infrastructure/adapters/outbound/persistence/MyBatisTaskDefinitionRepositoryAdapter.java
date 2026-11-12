package com.acc.workflow.infrastructure.adapters.outbound.persistence;

import com.acc.workflow.domain.taskdef.model.TaskDefinitionAggregate;
import com.acc.workflow.domain.taskdef.repository.TaskDefinitionRepositoryPort;
import com.acc.workflow.domain.taskdef.valobj.TaskDefId;
import com.acc.workflow.infrastructure.adapters.outbound.persistence.mybatis.TaskDefinitionMyBatisMapper;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Repository;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

/**
 * Production Outbound Persistence Adapter for TaskDefinitions using MyBatis.
 */
@Primary
@Repository("myBatisTaskDefinitionRepositoryAdapter")
public class MyBatisTaskDefinitionRepositoryAdapter implements TaskDefinitionRepositoryPort {

    private final TaskDefinitionMyBatisMapper mapper;

    public MyBatisTaskDefinitionRepositoryAdapter(TaskDefinitionMyBatisMapper mapper) {
        this.mapper = mapper;
    }

    @Override
    public void save(TaskDefinitionAggregate aggregate) {
        if (aggregate != null) {
            mapper.upsertTaskDefinition(aggregate);
        }
    }

    @Override
    public Optional<TaskDefinitionAggregate> findById(TaskDefId id) {
        if (id == null) return Optional.empty();
        return Optional.ofNullable(mapper.selectById(id.value()));
    }

    @Override
    public Optional<TaskDefinitionAggregate> findLatestByName(String tenantId, String name) {
        if (name == null) return Optional.empty();
        return Optional.ofNullable(mapper.selectLatestByName(tenantId, name));
    }

    @Override
    public Optional<TaskDefinitionAggregate> findByNameAndVersion(String tenantId, String name, int version) {
        if (name == null || version <= 0) return Optional.empty();
        return Optional.ofNullable(mapper.selectByNameAndVersion(tenantId, name, version));
    }

    @Override
    public Optional<TaskDefinitionAggregate> findActiveByName(String tenantId, String name) {
        if (name == null) return Optional.empty();
        return Optional.ofNullable(mapper.selectActiveByName(tenantId, name));
    }

    @Override
    public List<TaskDefinitionAggregate> listVersions(String tenantId, String name) {
        if (name == null) return Collections.emptyList();
        return mapper.selectVersions(tenantId, name);
    }

    @Override
    public List<TaskDefinitionAggregate> listLatestDefinitions(String tenantId) {
        return mapper.selectLatestDefinitions(tenantId);
    }

    @Override
    public void deprecateActiveVersionsExcept(String tenantId, String name, TaskDefId excludedId, long nowEpochMs) {
        if (name != null && excludedId != null) {
            mapper.deprecateActiveVersionsExcept(tenantId, name, excludedId.value(), nowEpochMs);
        }
    }
}
