package com.acc.fw.jpa;

import org.hibernate.boot.model.naming.Identifier;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class MixedCaseQuotingPhysicalNamingStrategyTest {

    private final MixedCaseQuotingPhysicalNamingStrategy strategy = new MixedCaseQuotingPhysicalNamingStrategy();

    @Test
    void testQuotesMixedCaseIdentifiers() {
        Identifier createdBy = Identifier.toIdentifier("createdBy_uid");
        Identifier result = strategy.toPhysicalColumnName(createdBy, null);
        assertThat(result.isQuoted()).isTrue();
        assertThat(result.getText()).isEqualTo("createdBy_uid");

        Identifier lastUpdated = Identifier.toIdentifier("lastUpdatedBy_uid");
        assertThat(strategy.toPhysicalColumnName(lastUpdated, null).isQuoted()).isTrue();

        Identifier deletedDate = Identifier.toIdentifier("deletedDate");
        assertThat(strategy.toPhysicalColumnName(deletedDate, null).isQuoted()).isTrue();

        Identifier createdDate = Identifier.toIdentifier("createdDate");
        assertThat(strategy.toPhysicalColumnName(createdDate, null).isQuoted()).isTrue();
    }

    @Test
    void testLeavesSingleCaseIdentifiersUnquoted() {
        // Table names (all upper)
        Identifier entityTypes = Identifier.toIdentifier("UNIPOST_ENTITY_TYPES");
        Identifier resultTable = strategy.toPhysicalTableName(entityTypes, null);
        assertThat(resultTable.isQuoted()).isFalse();

        // Table names with mixed case (e.g. UNIPOST_IDENTITY_user) must NOT be quoted
        // so PostgreSQL can fold them to lowercase and match unquoted DDL tables in catalog.
        Identifier identityUser = Identifier.toIdentifier("UNIPOST_IDENTITY_user");
        Identifier resultIdentityUser = strategy.toPhysicalTableName(identityUser, null);
        assertThat(resultIdentityUser.isQuoted()).isFalse();
        assertThat(resultIdentityUser.getText()).isEqualTo("UNIPOST_IDENTITY_user");

        // Standard snake_case columns (all lower)
        Identifier tenantId = Identifier.toIdentifier("tenant_id");
        assertThat(strategy.toPhysicalColumnName(tenantId, null).isQuoted()).isFalse();

        Identifier systemName = Identifier.toIdentifier("system_name");
        assertThat(strategy.toPhysicalColumnName(systemName, null).isQuoted()).isFalse();

        Identifier id = Identifier.toIdentifier("id");
        assertThat(strategy.toPhysicalColumnName(id, null).isQuoted()).isFalse();
    }
}
