package com.acc.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

class DynamicIndexProvisionerAttributeTest {

    private DynamicIndexProvisioner provisioner;

    @BeforeEach
    void setUp() {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        provisioner = new DynamicIndexProvisioner(jdbcTemplate);
    }

    @Test
    @DisplayName("Should generate correct expression index for STRING attribute")
    void shouldGenerateStringExpressionIndex() {
        String ddl = provisioner.generateAttributeIndexStatement(42L, "title", "STRING");
        assertThat(ddl).isNotNull();
        assertThat(ddl).contains("CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ent_attr_42_title");
        assertThat(ddl).contains("ON UNIPOST_ENTITIES ((attributes->>'title'))");
        assertThat(ddl).contains("WHERE (entity_type_id = 42 AND \"deletedDate\" IS NULL);");
    }

    @Test
    @DisplayName("Should generate correct expression index with numeric cast for NUMERIC attribute")
    void shouldGenerateNumericExpressionIndex() {
        String ddl = provisioner.generateAttributeIndexStatement(10L, "price", "NUMERIC");
        assertThat(ddl).isNotNull();
        assertThat(ddl).contains("idx_ent_attr_10_price");
        assertThat(ddl).contains("ON UNIPOST_ENTITIES (((attributes->>'price')::numeric))");
    }

    @Test
    @DisplayName("Should generate correct expression index with timestamp cast for DATE attribute")
    void shouldGenerateDateExpressionIndex() {
        String ddl = provisioner.generateAttributeIndexStatement(5L, "published_at", "DATE");
        assertThat(ddl).isNotNull();
        assertThat(ddl).contains("idx_ent_attr_5_published_at");
        assertThat(ddl).contains("ON UNIPOST_ENTITIES (((attributes->>'published_at')::timestamp))");
    }
}
