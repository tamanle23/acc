package com.acc.workflow.infrastructure.adapters.outbound.persistence.mybatis;

import com.acc.workflow.domain.taskdef.model.TaskDefinitionAggregate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface TaskDefinitionMyBatisMapper {

    TaskDefinitionAggregate selectById(@Param("id") String id);

    TaskDefinitionAggregate selectLatestByName(@Param("tenantId") String tenantId, @Param("name") String name);

    TaskDefinitionAggregate selectByNameAndVersion(@Param("tenantId") String tenantId, @Param("name") String name, @Param("version") int version);

    TaskDefinitionAggregate selectActiveByName(@Param("tenantId") String tenantId, @Param("name") String name);

    List<TaskDefinitionAggregate> selectVersions(@Param("tenantId") String tenantId, @Param("name") String name);

    List<TaskDefinitionAggregate> selectLatestDefinitions(@Param("tenantId") String tenantId);

    void deprecateActiveVersionsExcept(
        @Param("tenantId") String tenantId,
        @Param("name") String name,
        @Param("excludedId") String excludedId,
        @Param("nowEpochMs") long nowEpochMs
    );

    void upsertTaskDefinition(TaskDefinitionAggregate aggregate);
}
