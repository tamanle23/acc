package com.acc.fs.infrastructure.adapters.outbound.persistence.mybatis;

import com.acc.fs.domain.model.FsObjectAggregate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface FsObjectMyBatisMapper {

    FsObjectAggregate selectById(@Param("id") String id);

    List<FsObjectAggregate> selectAllByParentUid(
        @Param("tenantId") String tenantId,
        @Param("parentUid") String parentUid
    );

    List<FsObjectAggregate> selectAllDirectories(
        @Param("tenantId") String tenantId,
        @Param("parentUid") String parentUid
    );

    void upsertFsObject(FsObjectAggregate aggregate);

    void deleteById(@Param("id") String id);

    void insertRelation(
        @Param("parentUid") String parentUid,
        @Param("childUid") String childUid,
        @Param("tenantId") String tenantId
    );
}
