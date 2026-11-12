package com.acc.workflow.infrastructure.adapters.outbound.persistence.mybatis;

import com.acc.workflow.domain.taskdef.valobj.TaskStatus;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class TaskStatusTypeHandler extends BaseTypeHandler<TaskStatus> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, TaskStatus parameter, JdbcType jdbcType) throws SQLException {
        ps.setString(i, parameter != null ? parameter.name() : TaskStatus.DRAFT.name());
    }

    @Override
    public TaskStatus getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return fromString(rs.getString(columnName));
    }

    @Override
    public TaskStatus getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return fromString(rs.getString(columnIndex));
    }

    @Override
    public TaskStatus getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return fromString(cs.getString(columnIndex));
    }

    private TaskStatus fromString(String val) {
        if (val == null || val.isBlank()) return TaskStatus.DRAFT;
        try {
            return TaskStatus.valueOf(val.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return TaskStatus.DRAFT;
        }
    }
}
