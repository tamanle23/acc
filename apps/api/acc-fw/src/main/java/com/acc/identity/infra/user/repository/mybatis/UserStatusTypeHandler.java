package com.acc.identity.infra.user.repository.mybatis;

import com.acc.identity.domain.user.valobj.UserStatus;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class UserStatusTypeHandler extends BaseTypeHandler<UserStatus> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, UserStatus parameter, JdbcType jdbcType) throws SQLException {
        // Map ACTIVE -> 1, PENDING_ACTIVATION -> 0, DISABLED -> 2, LOCKED -> 3
        int val = switch (parameter) {
            case ACTIVE -> 1;
            case PENDING_ACTIVATION -> 0;
            case DISABLED -> 2;
            case LOCKED -> 3;
        };
        ps.setInt(i, val);
    }

    @Override
    public UserStatus getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return fromInt(rs.getInt(columnName));
    }

    @Override
    public UserStatus getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return fromInt(rs.getInt(columnIndex));
    }

    @Override
    public UserStatus getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return fromInt(cs.getInt(columnIndex));
    }

    private UserStatus fromInt(int val) {
        return switch (val) {
            case 1 -> UserStatus.ACTIVE;
            case 2 -> UserStatus.DISABLED;
            case 3 -> UserStatus.LOCKED;
            default -> UserStatus.PENDING_ACTIVATION;
        };
    }
}
