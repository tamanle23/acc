package com.acc.fw;


import org.apache.ibatis.type.BaseTypeHandler;
import org.apache.ibatis.type.JdbcType;

import javax.naming.ldap.HasControls;
import java.sql.CallableStatement;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

public class CommaSplitTypeHandler extends BaseTypeHandler<Set<String>> {

  @Override
  public void setNonNullParameter(PreparedStatement ps, int i, Set<String> parameter, JdbcType jdbcType) throws SQLException {

  }

  @Override
  public Set<String> getNullableResult(ResultSet rs, String columnName) throws SQLException {
    String s = rs.getString(columnName);
    return s == null ? null : new HashSet<String>(Arrays.asList(s.split(",")));
  }

  @Override
  public Set<String> getNullableResult(ResultSet rs, int columnIndex) throws SQLException {
    String s = rs.getString(columnIndex);
    return s == null ? null : new HashSet<String>(Arrays.asList(s.split(",")));
  }

  @Override
  public Set<String> getNullableResult(CallableStatement cs, int columnIndex) throws SQLException {
    return null;
  }
}
