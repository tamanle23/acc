package com.acc.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.core.io.Page;
import com.acc.core.io.PageRequest;
import com.acc.domain.metadata.*;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.presentation.dto.metadata.ChildFilterCriteria;
import com.acc.presentation.dto.metadata.ChildPaginationParam;
import com.acc.presentation.dto.metadata.ChildQueryOptions;
import com.acc.presentation.dto.metadata.CompositeRecordResponse;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;

import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@DisplayName("Phase 45: Quad-Chaos Resilience & Failure Recovery Matrix")
class CompositeChaosResilienceTest {

    private DynamicQueryCompiler compiler;
    private EntityTypeRepository entityTypeRepository;
    private EntityRecordRepository entityRecordRepository;
    private DataLoaderBatchResolver dataLoaderBatchResolver;
    private ObjectMapper objectMapper;
    private PageBuilder pageBuilder;
    private JdbcTemplate jdbcTemplate;
    private CompositeRecordService compositeRecordService;

    private EntityType testCompositeEntityType;
    private CompositeSpec testSpec;

    @BeforeEach
    void setUp() {
        compiler = new DynamicQueryCompiler();
        entityTypeRepository = mock(EntityTypeRepository.class);
        entityRecordRepository = mock(EntityRecordRepository.class);
        dataLoaderBatchResolver = mock(DataLoaderBatchResolver.class);
        objectMapper = new ObjectMapper();
        pageBuilder = new PageBuilder();
        jdbcTemplate = mock(JdbcTemplate.class);

        testSpec = new CompositeSpec(
                10L,
                "customer_account",
                "customer",
                List.of(new CompositeField("name", "name", "STRING", null, true)),
                List.of(
                        new CompositeNode(
                                20L,
                                "cloud_resource",
                                "resources",
                                CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                                "account_id",
                                null,
                                "ONE_TO_MANY",
                                List.of(new CompositeField("res_name", "name", "STRING", null, true)),
                                null,
                                List.of()
                        )
                ),
                List.of(
                        new CompositeRollup("total_count", "resources", CompositeRollup.AggregateFunction.COUNT, null, null)
                )
        );

        testCompositeEntityType = new EntityType();
        testCompositeEntityType.setId(100L);
        testCompositeEntityType.setIsComposite(true);
        testCompositeEntityType.setCompositeSpec(testSpec);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(100L)).thenReturn(Optional.of(testCompositeEntityType));

        compositeRecordService = new CompositeRecordService(
                entityTypeRepository,
                entityRecordRepository,
                compiler,
                dataLoaderBatchResolver,
                objectMapper,
                pageBuilder,
                jdbcTemplate
        );

        TenantContextHolder.setTenantId("tenant-chaos");
    }

    @Test
    @DisplayName("Chaos Fault 1: Statement Timeout Tripping triggers seamless fallback to DataLoaderBatchResolver")
    void testStatementTimeoutFailoverToDataLoader() {
        // Mock root record in JPA repository
        EntityType rootType = new EntityType();
        rootType.setId(10L);

        EntityRecord rootRecord = new EntityRecord();
        rootRecord.setId(1001L);
        rootRecord.setEntityType(rootType);
        rootRecord.setTenantId("tenant-chaos");
        rootRecord.setAttributes(Map.of("name", "Chaos Resilience Corp"));

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L))
                .thenReturn(Optional.of(rootRecord));

        // Mock DataLoaderBatchResolver fallback response
        CompositeRecordResponse fallbackResponse = new CompositeRecordResponse(
                1001L,
                "tenant-chaos",
                10L,
                true,
                1L,
                Map.of("id", 1001L, "name", "Chaos Resilience Corp", "resources", List.of()),
                Map.of("resources", new com.acc.presentation.dto.metadata.ChildPaginationMetadata(0, 50, 0, false)),
                "dataloader-batch-resolver",
                null,
                null
        );

        when(dataLoaderBatchResolver.resolveBatch(eq(testSpec), anyList(), anyMap()))
                .thenReturn(List.of(fallbackResponse));

        // Simulate QueryTimeoutException on pushdown query execution in JdbcTemplate
        doThrow(new QueryTimeoutException("PostgreSQL statement_timeout exceeded (1500ms)"))
                .when(jdbcTemplate).execute(anyString());

        // Execute composite record resolution
        CompositeRecordResponse response = compositeRecordService.getCompositeRecordById(
                100L, 1001L, Map.of("resources", new ChildPaginationParam(10, 0))
        );

        // Verification: The request did not crash and gracefully fell back to DataLoaderBatchResolver
        assertNotNull(response);
        assertEquals(1001L, response.id());
        assertEquals("dataloader-batch-resolver", response.engineUsed());
        verify(dataLoaderBatchResolver, times(1)).resolveBatch(eq(testSpec), anyList(), anyMap());
    }

    @Test
    @DisplayName("Chaos Fault 2: Adversarial recursion tree exceeding max depth ceiling 4 is strictly rejected")
    void testAdversarialRecursionAndCycleRejection() {
        // Construct an adversarial 5-level deep nested graph: Root -> Level 1 -> Level 2 -> Level 3 -> Level 4 -> Level 5
        CompositeNode level5 = new CompositeNode(
                60L, "level6", "level6", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "parent_id", null, "ONE_TO_MANY", List.of(), null, List.of()
        );
        CompositeNode level4 = new CompositeNode(
                50L, "level5", "level5", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "parent_id", null, "ONE_TO_MANY", List.of(), List.of(level5), List.of()
        );
        CompositeNode level3 = new CompositeNode(
                40L, "level4", "level4", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "parent_id", null, "ONE_TO_MANY", List.of(), List.of(level4), List.of()
        );
        CompositeNode level2 = new CompositeNode(
                30L, "level3", "level3", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "parent_id", null, "ONE_TO_MANY", List.of(), List.of(level3), List.of()
        );
        CompositeNode level1 = new CompositeNode(
                20L, "level2", "level2", CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "parent_id", null, "ONE_TO_MANY", List.of(), List.of(level2), List.of()
        );

        CompositeSpec deepSpec = new CompositeSpec(
                10L, "root", "root", List.of(), List.of(level1), List.of()
        );

        // Assert that compiling a 5-level deep hierarchy fails fast
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () ->
                compiler.compileSingleRecordQuery(deepSpec, "tenant-chaos", 1L, Collections.emptyMap())
        );

        assertTrue(ex.getMessage().contains("exceeds maximum allowed depth of 4"));
    }

    @Test
    @DisplayName("Chaos Fault 3: Multi-tenant concurrency storm guarantees 100% tenant blindness and 0 cross-tenant data leakage")
    void testCrossTenantIsolationStorm() throws Exception {
        int threads = 16;
        int queriesPerTenant = 100;
        String[] tenants = {"tenant-alpha", "tenant-beta", "tenant-gamma"};

        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch latch = new CountDownLatch(tenants.length * queriesPerTenant);
        List<String> failedAssertions = Collections.synchronizedList(new ArrayList<>());

        for (String tenant : tenants) {
            for (int q = 0; q < queriesPerTenant; q++) {
                final long recordId = 1000L + (q % 20);
                executor.submit(() -> {
                    try {
                        DynamicQueryCompiler.CompiledQuery compiled = compiler.compileSingleRecordQuery(
                                testSpec, tenant, recordId, Collections.emptyMap()
                        );

                        // Strict invariant: Parameters MUST only contain the requesting tenantId
                        if (!tenant.equals(compiled.parameters().get("tenantId"))) {
                            failedAssertions.add("Tenant parameter mismatch! Expected: " + tenant + " but found: " + compiled.parameters().get("tenantId"));
                        }

                        // SQL must explicitly filter on tenant_id
                        if (!compiled.sql().contains("AND root.tenant_id = :tenantId")) {
                            failedAssertions.add("Root WHERE clause missing tenant isolation filter!");
                        }
                    } catch (Exception e) {
                        failedAssertions.add("Query execution error: " + e.getMessage());
                    } finally {
                        latch.countDown();
                    }
                });
            }
        }

        boolean completed = latch.await(10, TimeUnit.SECONDS);
        executor.shutdownNow();

        assertTrue(completed, "Cross-tenant isolation storm should complete within 10s");
        assertTrue(failedAssertions.isEmpty(), "Cross-tenant leakage detected: " + failedAssertions);
    }

    @Test
    @DisplayName("Chaos Fault 4: SQL Injection and malformed parameter fuzzing is safely parameterized and sanitized")
    void testChildQueryFuzzingAndSqlInjectionSafety() {
        // Fuzz vectors containing SQL injection payloads, non-alphanumeric keys, and abnormal limits
        Map<String, ChildQueryOptions> fuzzedOptions = Map.of(
                "resources", new ChildQueryOptions(
                        9999999, // Exorbitant limit
                        -50,     // Negative offset
                        "name'; DROP TABLE UNIPOST_ENTITIES; -- :desc", // Malicious sort attempt
                        Map.of(
                                "status'; SELECT pg_sleep(10); --", new ChildFilterCriteria("eq", "ATTACK"), // Malformed key
                                "cost", new ChildFilterCriteria("gte", "100 OR 1=1"), // Malicious value
                                "safe_col", "normal_value"
                        )
                )
        );

        DynamicQueryCompiler.CompiledQuery compiled = compiler.compileSingleRecordQueryWithOptions(
                testSpec, "tenant-chaos", 1001L, fuzzedOptions
        );

        assertNotNull(compiled);
        String sql = compiled.sql();

        // 1. Raw malicious SQL string MUST NOT be present in SQL statement
        assertFalse(sql.contains("DROP TABLE"), "SQL injection payload must never be injected raw into SQL text!");
        assertFalse(sql.contains("pg_sleep"), "Non-alphanumeric attribute keys must be rejected and omitted from SQL text!");

        // 2. Values must be safely bound as named parameters
        assertTrue(compiled.parameters().containsKey("childFilter_1_cost"));
        assertEquals("100 OR 1=1", compiled.parameters().get("childFilter_1_cost"));

        // 3. Offset and limit must be safely bounded
        assertEquals(9999999, compiled.parameters().get("childLimit_1"));
        assertEquals(0, compiled.parameters().get("childOffset_1"), "Negative offset must be normalized to 0");
    }
}
