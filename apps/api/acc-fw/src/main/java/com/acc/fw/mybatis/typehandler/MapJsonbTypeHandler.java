package com.acc.fw.mybatis.typehandler;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;
import org.postgresql.util.PGobject;

import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collections;
import java.util.Map;

/**
 * MyBatis TypeHandler for Map&lt;String, Object&gt; mapped to a PostgreSQL JSONB column.
 */
public class MapJsonbTypeHandler extends BaseTypeHandler<Map<String, Object>> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<Map<String, Object>> TYPE_REF = new TypeReference<>() {};

    @Override
    public void setNonNullParameter(PreparedStatement ps, int i, Map<String, Object> parameter, JdbcType jdbcType) throws SQLException {
        try {
            PGobject jsonObject = new PGobject();
            jsonObject.setType("jsonb");
            jsonObject.setValue(MAPPER.writeValueAsString(parameter));
            ps.setObject(i, jsonObject);
        } catch (JsonProcessingException e) {
            throw new SQLException("Error serializing Map<String, Object> to JSONB", e);
        }
    }

    @Override
    public Map<String, Object> getNullableResult(ResultSet rs, String columnName) throws SQLException {
        return parse(rs.getString(columnName));
    }

    @Override
    public Map<String, Object> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
        return parse(rs.getString(columnIndex));
    }

    @Override
    public Map<String, Object> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
        return parse(cs.getString(columnIndex));
    }

    private Map<String, Object> parse(String json) throws SQLException {
        if (json == null || json.isBlank()) {
            return Collections.emptyMap();
        }
        try {
            return MAPPER.readValue(json, TYPE_REF);
        } catch (JsonProcessingException e) {
            throw new SQLException("Error deserializing JSONB to Map<String, Object>", e);
        }
    }
}
