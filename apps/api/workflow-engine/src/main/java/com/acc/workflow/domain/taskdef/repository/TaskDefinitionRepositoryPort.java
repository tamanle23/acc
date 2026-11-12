package com.acc.workflow.domain.taskdef.repository;

import com.acc.workflow.domain.taskdef.model.TaskDefinitionAggregate;
import com.acc.workflow.domain.taskdef.valobj.TaskDefId;

import java.util.List;
import java.util.Optional;

/**
 * Secondary Driven Port (SPI) for TaskDefinition persistence.
 * Zero framework dependencies.
 */
public interface TaskDefinitionRepositoryPort {

    void save(TaskDefinitionAggregate aggregate);

    Optional<TaskDefinitionAggregate> findById(TaskDefId id);

    Optional<TaskDefinitionAggregate> findLatestByName(String tenantId, String name);

    Optional<TaskDefinitionAggregate> findByNameAndVersion(String tenantId, String name, int version);

    Optional<TaskDefinitionAggregate> findActiveByName(String tenantId, String name);

    List<TaskDefinitionAggregate> listVersions(String tenantId, String name);

    List<TaskDefinitionAggregate> listLatestDefinitions(String tenantId);

    void deprecateActiveVersionsExcept(String tenantId, String name, TaskDefId excludedId, long nowEpochMs);
}
