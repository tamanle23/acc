package com.acc.fs.infrastructure.adapters.outbound.persistence.mybatis;

import com.acc.fs.domain.model.valobj.FileId;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class FileIdTypeHandler extends BaseTypeHandler<FileId> {

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, FileId parameter, JdbcType jdbcType) throws SQLException {
        ps.setString(i, parameter.value());
    }

    @Override
    public FileId getNullableResult(ResultSet rs, String columnName) throws SQLException {
        String val = rs.getString(columnName);
        return val != null ? FileId.of(val) : null;
    }

    @Override
    public FileId getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        String val = rs.getString(columnIndex);
        return val != null ? FileId.of(val) : null;
    }

    @Override
    public FileId getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        String val = cs.getString(columnIndex);
        return val != null ? FileId.of(val) : null;
    }
}
