package com.acc.workflow.infrastructure.adapters.outbound.persistence.mybatis;

import com.acc.workflow.domain.taskdef.valobj.TaskDefId;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class TaskDefIdTypeHandler extends BaseTypeHandler<TaskDefId> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, TaskDefId parameter, JdbcType jdbcType) throws SQLException {
        ps.setString(i, parameter.value());
    }

    @Override
    public TaskDefId getNullableResult(ResultSet rs, String columnName) throws SQLException {
        String val = rs.getString(columnName);
        return val != null ? TaskDefId.of(val) : null;
    }

    @Override
    public TaskDefId getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        String val = rs.getString(columnIndex);
        return val != null ? TaskDefId.of(val) : null;
    }

    @Override
    public TaskDefId getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        String val = cs.getString(columnIndex);
        return val != null ? TaskDefId.of(val) : null;
    }
}
