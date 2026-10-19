package com.unipost.service;

import com.unipost.domain.metadata.CompositeField;
import com.unipost.domain.metadata.CompositeJoinPattern;
import com.unipost.domain.metadata.CompositeNode;
import com.unipost.domain.metadata.CompositeSpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class DynamicIndexProvisionerTest {

    private JdbcTemplate jdbcTemplate;
    private DynamicIndexProvisioner provisioner;

    @BeforeEach
    void setUp() {
        jdbcTemplate = mock(JdbcTemplate.class);
        provisioner = new DynamicIndexProvisioner(jdbcTemplate);
    }

    @Test
    void testGenerateIndexStatements_NullSpecReturnsEmpty() {
        List<String> stmts = provisioner.generateIndexStatements(null);
        assertNotNull(stmts);
        assertTrue(stmts.isEmpty());
    }

    @Test
    void testGenerateIndexStatements_RootFieldsAndPatternBFK() {
        CompositeField idField = new CompositeField("id", "id", "STRING", null, true);
        CompositeField blankField = new CompositeField("  ", "blank", "STRING", null, true);
        CompositeField orderNum = new CompositeField("order_num", "orderNum", "STRING", null, true);

        CompositeNode grandchild = new CompositeNode(
                3L, "tracking", "tracking",
                CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "item_id", null, "ONE_TO_ONE",
                List.of(new CompositeField("tracking_code", "trackingCode", "STRING", null, true)),
                null
        );

        CompositeNode child = new CompositeNode(
                2L, "items", "items",
                CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "order_id", null, "ONE_TO_MANY",
                List.of(new CompositeField("sku", "sku", "STRING", null, true)),
                List.of(grandchild)
        );

        CompositeSpec spec = new CompositeSpec(
                1L, "orders", "Order composite",
                List.of(idField, blankField, orderNum),
                List.of(child)
        );

        List<String> stmts = provisioner.generateIndexStatements(spec);
        assertNotNull(stmts);
        assertEquals(3, stmts.size());

        // Root index for order_num
        assertTrue(stmts.get(0).contains("idx_comp_root_1_order_num"));
        assertTrue(stmts.get(0).contains("UNIPOST_ENTITIES"));

        // Child index for order_id
        assertTrue(stmts.get(1).contains("idx_comp_b_fk_2_order_id"));

        // Grandchild index for item_id
        assertTrue(stmts.get(2).contains("idx_comp_b_fk_3_item_id"));
    }

    @Test
    void testProvisionIndexesAsync_ExecutesDdlStatements() throws InterruptedException {
        CompositeField field = new CompositeField("customer_id", "customerId", "STRING", null, true);
        CompositeSpec spec = new CompositeSpec(1L, "orders", "desc", List.of(field), null);

        provisioner.provisionIndexesAsync(spec);

        // Allow async thread to run
        Thread.sleep(150);

        verify(jdbcTemplate, atLeastOnce()).execute(anyString());
    }

    @Test
    void testProvisionIndexesAsync_GracefulOnJdbcException() throws InterruptedException {
        doThrow(new RuntimeException("SQL execution error")).when(jdbcTemplate).execute(anyString());

        CompositeField field = new CompositeField("customer_id", "customerId", "STRING", null, true);
        CompositeSpec spec = new CompositeSpec(1L, "orders", "desc", List.of(field), null);

        assertDoesNotThrow(() -> provisioner.provisionIndexesAsync(spec));
        Thread.sleep(150);
    }
}
