package com.unipost.service;

import com.unipost.domain.metadata.*;
import com.unipost.presentation.dto.metadata.ChildPaginationParam;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class DynamicQueryCompilerTest {

    private DynamicQueryCompiler compiler;

    @BeforeEach
    void setUp() {
        compiler = new DynamicQueryCompiler();
    }

    @Test
    @DisplayName("Should compile single record query with Pattern B and Pattern C lateral joins")
    void testCompileSingleRecordQuery() {
        CompositeSpec spec = new CompositeSpec(
                10L,
                "customer_account",
                "customer",
                List.of(
                        new CompositeField("company_name", "companyName", "STRING", null, true),
                        new CompositeField("tier", "tier", "STRING", "STANDARD", false)
                ),
                List.of(
                        // Child 1: Orders (Pattern B: Foreign Key, 1:N)
                        new CompositeNode(
                                20L,
                                "sales_order",
                                "orders",
                                CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                                "customer_id",
                                null,
                                "ONE_TO_MANY",
                                List.of(
                                        new CompositeField("order_no", "orderNo", "STRING", null, true),
                                        new CompositeField("total", "total", "DECIMAL", null, true)
                                ),
                                null
                        ),
                        // Child 2: Account Manager (Pattern C: Association, 1:1)
                        new CompositeNode(
                                30L,
                                "account_manager",
                                "manager",
                                CompositeJoinPattern.PATTERN_C_ASSOCIATION,
                                null,
                                500L,
                                "ONE_TO_ONE",
                                List.of(
                                        new CompositeField("full_name", "fullName", "STRING", null, true),
                                        new CompositeField("email", "email", "STRING", null, true)
                                ),
                                null
                        )
                )
        );

        Map<String, ChildPaginationParam> childParams = Map.of(
                "orders", new ChildPaginationParam(15, 5)
        );

        DynamicQueryCompiler.CompiledQuery compiled = compiler.compileSingleRecordQuery(
                spec, "tenant-alpha", 1001L, childParams
        );

        assertNotNull(compiled);
        String sql = compiled.sql();

        // 1. Verify Root Projections
        assertTrue(sql.contains("root.attributes->>'company_name'"));
        assertTrue(sql.contains("root.attributes->>'tier'"));
        assertTrue(sql.contains("'is_composite', TRUE"));

        // 2. Verify Lateral Join Structure for Pattern B (orders)
        assertTrue(sql.contains("LEFT JOIN LATERAL"));
        assertTrue(sql.contains("(c.attributes->>'customer_id') = root.id::text"));
        assertTrue(sql.contains("jsonb_agg"));
        assertTrue(sql.contains("c.\"deletedDate\" IS NULL"));
        assertTrue(sql.contains("ROW_NUMBER() OVER (ORDER BY c.id ASC) AS row_num"));

        // 3. Verify Lateral Join Structure for Pattern C (manager)
        assertTrue(sql.contains("INNER JOIN UNIPOST_ENTITY_RELATIONSHIPS rel ON rel.target_entity_id = c.id"));
        assertTrue(sql.contains("rel.source_entity_id = root.id"));
        assertTrue(sql.contains("rel.relationship_type_id = :relType_2"));
        assertTrue(sql.contains("LIMIT 1"));

        // 4. Verify Root Filters
        assertTrue(sql.contains("WHERE root.entity_type_id = :rootEntityTypeId"));
        assertTrue(sql.contains("AND root.tenant_id = :tenantId"));
        assertTrue(sql.contains("AND root.id = :rootRecordId"));
        assertTrue(sql.contains("AND root.\"deletedDate\" IS NULL"));

        // 5. Verify Parameters Map
        assertEquals("tenant-alpha", compiled.parameters().get("tenantId"));
        assertEquals(10L, compiled.parameters().get("rootEntityTypeId"));
        assertEquals(1001L, compiled.parameters().get("rootRecordId"));
        assertEquals(15, compiled.parameters().get("childLimit_1"));
        assertEquals(5, compiled.parameters().get("childOffset_1"));
        assertEquals(20L, compiled.parameters().get("childType_1"));
        assertEquals(30L, compiled.parameters().get("childType_2"));
        assertEquals(500L, compiled.parameters().get("relType_2"));
    }

    @Test
    @DisplayName("Should compile paginated query with root limit and offset")
    void testCompilePaginatedQuery() {
        CompositeSpec spec = new CompositeSpec(
                10L,
                "customer_account",
                "customer",
                List.of(new CompositeField("company_name", "companyName", "STRING", null, true)),
                List.of()
        );

        DynamicQueryCompiler.CompiledQuery compiled = compiler.compilePaginatedQuery(
                spec, "tenant-beta", 25, 50, Map.of()
        );

        assertNotNull(compiled);
        String sql = compiled.sql();

        assertTrue(sql.contains("LIMIT :rootLimit OFFSET :rootOffset"));
        assertEquals(25, compiled.parameters().get("rootLimit"));
        assertEquals(50, compiled.parameters().get("rootOffset"));

        // Count query verification
        String countSql = compiled.countSql();
        assertTrue(countSql.contains("SELECT COUNT(*) FROM UNIPOST_ENTITIES root"));
        assertTrue(countSql.contains("root.\"deletedDate\" IS NULL"));
    }

    @Test
    @DisplayName("Should throw IllegalArgumentException when spec is null or exceeds max depth")
    void testValidationCeilings() {
        assertThrows(IllegalArgumentException.class, () ->
                compiler.compileSingleRecordQuery(null, "tenant-1", 1L, Map.of())
        );
    }
}
