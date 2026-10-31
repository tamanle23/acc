package com.acc.fw.jpa;

import org.hibernate.boot.model.naming.Identifier;
import org.hibernate.boot.model.naming.PhysicalNamingStrategyStandardImpl;
import org.hibernate.engine.jdbc.env.spi.JdbcEnvironment;

/**
 * Physical naming strategy aligned with Liquibase's default (LEGACY) object quoting on PostgreSQL.
 *
 * <p>Liquibase creates mixed-case identifiers (e.g. {@code createdBy_uid}, {@code deletedDate})
 * as quoted, case-sensitive columns, while Hibernate emits unquoted names that PostgreSQL folds to
 * lower case ({@code createdby_uid}), producing "column does not exist" errors. This strategy quotes
 * only identifiers containing both upper- and lower-case letters, leaving all-lower/all-upper names
 * (such as {@code UNIPOST_ENTITY_TYPES} or {@code tenant_id}) unquoted exactly as Liquibase does.
 */
public class MixedCaseQuotingPhysicalNamingStrategy extends PhysicalNamingStrategyStandardImpl {

  private static final long serialVersionUID = 1L;

  @Override
  public Identifier toPhysicalTableName(Identifier name, JdbcEnvironment context) {
    // In PostgreSQL and standard SQL, table names created via unquoted DDL (e.g. UNIPOST_IDENTITY_USER
    // or UNIPOST_ENTITY_TYPES) are folded to lowercase in the system catalog.
    // Quoting table names forces exact-case matching in PostgreSQL ("UNIPOST_IDENTITY_user"),
    // breaking table lookup when entities declare mixed-case names (e.g. UNIPOST_IDENTITY_ + "user").
    // Therefore, table names must remain unquoted unless already explicitly quoted in the mapping.
    return name != null && name.isQuoted() ? name : (name != null ? Identifier.toIdentifier(name.getText(), false) : null);
  }

  @Override
  public Identifier toPhysicalColumnName(Identifier name, JdbcEnvironment context) {
    return quoteIfMixedCase(name);
  }

  @Override
  public Identifier toPhysicalSequenceName(Identifier name, JdbcEnvironment context) {
    return quoteIfMixedCase(name);
  }

  static Identifier quoteIfMixedCase(Identifier name) {
    if (name == null || name.isQuoted()) {
      return name;
    }
    String text = name.getText();
    boolean hasUpper = !text.equals(text.toLowerCase());
    boolean hasLower = !text.equals(text.toUpperCase());
    return hasUpper && hasLower ? Identifier.toIdentifier(text, true) : name;
  }
}
