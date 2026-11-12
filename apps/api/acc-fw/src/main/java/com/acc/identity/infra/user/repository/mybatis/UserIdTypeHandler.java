package com.acc.identity.infra.user.repository.mybatis;

import com.acc.identity.domain.user.valobj.UserId;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class UserIdTypeHandler extends BaseTypeHandler<UserId> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, UserId parameter, JdbcType jdbcType) throws SQLException {
        ps.setString(i, parameter.value());
    }

    @Override
    public UserId getNullableResult(ResultSet rs, String columnName) throws SQLException {
        String val = rs.getString(columnName);
        return val != null ? UserId.of(val) : null;
    }

    @Override
    public UserId getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        String val = rs.getString(columnIndex);
        return val != null ? UserId.of(val) : null;
    }

    @Override
    public UserId getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        String val = cs.getString(columnIndex);
        return val != null ? UserId.of(val) : null;
    }
}
