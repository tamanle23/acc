package com.acc.identity.infra.user.repository.mybatis;

import com.acc.identity.domain.user.model.UserAggregate;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

@Mapper
public interface UserMyBatisMapper {

    UserAggregate selectById(@Param("id") String id);

    UserAggregate selectByEmail(@Param("tenantId") String tenantId, @Param("email") String email);

    UserAggregate selectByUsername(@Param("tenantId") String tenantId, @Param("username") String username);

    int countByEmail(@Param("tenantId") String tenantId, @Param("email") String email);

    int countByUsername(@Param("tenantId") String tenantId, @Param("username") String username);

    void upsertUser(UserAggregate user);

    void updateStatus(@Param("id") String id, @Param("status") String status, @Param("updatedAt") long updatedAt);
}
