package com.unipost.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.core.io.Page;
import com.unipost.core.io.PageRequest;
import com.unipost.domain.metadata.CompositeField;
import com.unipost.domain.metadata.CompositeJoinPattern;
import com.unipost.domain.metadata.CompositeNode;
import com.unipost.domain.metadata.CompositeSpec;
import com.unipost.domain.metadata.EntityRecord;
import com.unipost.domain.metadata.EntityType;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.presentation.dto.metadata.ChildPaginationMetadata;
import com.unipost.presentation.dto.metadata.ChildPaginationParam;
import com.unipost.presentation.dto.metadata.CompositeRecordResponse;
import com.unipost.repository.jpa.EntityRecordRepository;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.service.exception.MetadataNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CompositeRecordServiceTest {

    @Mock
    private EntityTypeRepository entityTypeRepository;
    @Mock
    private EntityRecordRepository entityRecordRepository;
    @Mock
    private DynamicQueryCompiler dynamicQueryCompiler;
    @Mock
    private DataLoaderBatchResolver dataLoaderBatchResolver;
    @Mock
    private PageBuilder pageBuilder;
    @Spy
    private ObjectMapper objectMapper = new ObjectMapper();

    private CompositeRecordService service;
    private EntityType compositeEntityType;
    private CompositeSpec compositeSpec;

    @BeforeEach
    void setUp() {
        TenantContextHolder.setTenantId("tenant-test");

        service = new CompositeRecordService(
                entityTypeRepository,
                entityRecordRepository,
                dynamicQueryCompiler,
                dataLoaderBatchResolver,
                objectMapper,
                pageBuilder,
                null // null jdbcTemplate triggers direct DataLoader fallback
        );

        compositeSpec = new CompositeSpec(
                10L,
                "customer",
                "customer",
                List.of(new CompositeField("company_name", "companyName", "STRING", null, true)),
                List.of(new CompositeNode(
                        20L,
                        "sales_order",
                        "orders",
                        CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                        "customer_id",
                        null,
                        "ONE_TO_MANY",
                        List.of(new CompositeField("order_no", "orderNo", "STRING", null, true)),
                        null
                ))
        );

        compositeEntityType = new EntityType();
        compositeEntityType.setId(100L);
        compositeEntityType.setName("Customer360");
        compositeEntityType.setSystemName("customer_360");
        compositeEntityType.setIsComposite(true);
        compositeEntityType.setCompositeSpec(compositeSpec);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void getCompositeRecordById_WhenEntityTypeNotFound_ThrowsMetadataNotFoundException() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(999L)).thenReturn(Optional.empty());

        assertThrows(MetadataNotFoundException.class, () ->
                service.getCompositeRecordById(999L, 1L, Collections.emptyMap()));
    }

    @Test
    void getCompositeRecordById_WhenEntityTypeNotComposite_ThrowsIllegalArgumentException() {
        EntityType nonComposite = new EntityType();
        nonComposite.setId(101L);
        nonComposite.setName("SimpleEntity");
        nonComposite.setIsComposite(false);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(101L)).thenReturn(Optional.of(nonComposite));

        assertThrows(IllegalArgumentException.class, () ->
                service.getCompositeRecordById(101L, 1L, Collections.emptyMap()));
    }

    @Test
    void getCompositeRecordById_DataLoaderFallback_ResolvesRecord() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(100L)).thenReturn(Optional.of(compositeEntityType));

        EntityRecord root = new EntityRecord();
        root.setId(1L);
        root.setTenantId("tenant-test");
        root.setEntityType(compositeEntityType);
        root.setSchemaVersion(1L);
        root.setAttributes(Map.of("company_name", "Acme Corp"));

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1L))
                .thenReturn(Optional.of(root));

        CompositeRecordResponse expectedResponse = new CompositeRecordResponse(
                1L,
                "tenant-test",
                10L,
                true,
                1L,
                Map.of("id", 1L, "orders", List.of(Map.of("id", 101L))),
                Map.of("orders", new ChildPaginationMetadata(1L, 50, 0, false)),
                "dataloader-fallback",
                LocalDateTime.now(),
                LocalDateTime.now()
        );

        when(dataLoaderBatchResolver.resolveBatch(eq(compositeSpec), anyList(), anyMap()))
                .thenReturn(List.of(expectedResponse));

        CompositeRecordResponse result = service.getCompositeRecordById(100L, 1L, Map.of("orders", new ChildPaginationParam(10, 0)));

        assertNotNull(result);
        assertEquals(1L, result.id());
        assertEquals("tenant-test", result.tenantId());
        assertEquals("dataloader-fallback", result.engineUsed());
        assertTrue(result.childPagination().containsKey("orders"));
        assertEquals(1L, result.childPagination().get("orders").totalElements());
    }

    @Test
    @SuppressWarnings("unchecked")
    void getCompositeRecordsPage_DataLoaderFallback_ResolvesPage() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(100L)).thenReturn(Optional.of(compositeEntityType));

        EntityRecord root = new EntityRecord();
        root.setId(1L);
        root.setTenantId("tenant-test");
        root.setEntityType(compositeEntityType);
        root.setSchemaVersion(1L);

        org.springframework.data.domain.Page<EntityRecord> springPage =
                new org.springframework.data.domain.PageImpl<>(List.of(root));
        when(entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(eq(10L), any()))
                .thenReturn(springPage);

        CompositeRecordResponse expectedResponse = new CompositeRecordResponse(
                1L,
                "tenant-test",
                10L,
                true,
                1L,
                Map.of("id", 1L, "orders", List.of(Map.of("id", 101L))),
                Map.of("orders", new ChildPaginationMetadata(1L, 50, 0, false)),
                "dataloader-fallback",
                LocalDateTime.now(),
                LocalDateTime.now()
        );
        when(dataLoaderBatchResolver.resolveBatch(eq(compositeSpec), anyList(), anyMap()))
                .thenReturn(List.of(expectedResponse));

        PageRequest req = new PageRequest();
        req.setNumber(1);
        req.setSize(10);

        Page<CompositeRecordResponse> expectedMockPage = new Page<>();
        doReturn(expectedMockPage).when(pageBuilder).build(eq(req), any(), any());

        Page<CompositeRecordResponse> page = service.getCompositeRecordsPage(100L, req, Collections.emptyMap());

        assertNotNull(page);
        verify(dataLoaderBatchResolver, times(1)).resolveBatch(eq(compositeSpec), anyList(), anyMap());
    }

    @Test
    void getCompositeRecordById_WhenCompositeSpecIsNull_ThrowsIllegalArgumentException() {
        EntityType invalidComposite = new EntityType();
        invalidComposite.setId(102L);
        invalidComposite.setName("MissingSpec");
        invalidComposite.setIsComposite(true);
        invalidComposite.setCompositeSpec(null);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(102L)).thenReturn(Optional.of(invalidComposite));

        assertThrows(IllegalArgumentException.class, () ->
                service.getCompositeRecordById(102L, 1L, Collections.emptyMap()));
    }

    @Test
    void getCompositeRecordById_WithPushdownSuccess_ReturnsPushdownResponse() throws Exception {
        org.springframework.jdbc.core.JdbcTemplate mockJdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate mockNamedJdbc =
                mock(org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate.class);

        CompositeRecordService serviceWithJdbc = new CompositeRecordService(
                entityTypeRepository,
                entityRecordRepository,
                dynamicQueryCompiler,
                dataLoaderBatchResolver,
                objectMapper,
                pageBuilder,
                mockJdbc,
                mockNamedJdbc
        );

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(100L)).thenReturn(Optional.of(compositeEntityType));
        when(dynamicQueryCompiler.compileSingleRecordQueryWithOptions(any(), anyString(), anyLong(), anyMap()))
                .thenReturn(new DynamicQueryCompiler.CompiledQuery("SELECT 1", Map.of(), null, null));

        java.sql.ResultSet rs = mock(java.sql.ResultSet.class);
        when(rs.getLong("root_id")).thenReturn(1L);
        when(rs.getString("root_tenant_id")).thenReturn("tenant-test");
        when(rs.getLong("root_entity_type_id")).thenReturn(10L);
        when(rs.getLong("root_schema_version")).thenReturn(1L);
        when(rs.getTimestamp("root_created_date")).thenReturn(java.sql.Timestamp.valueOf(LocalDateTime.now()));
        when(rs.getTimestamp("root_updated_date")).thenReturn(java.sql.Timestamp.valueOf(LocalDateTime.now()));
        when(rs.getString("composite_document")).thenReturn("{\"companyName\":\"Acme Corp\"}");
        when(rs.getString("child_pagination_metadata")).thenReturn("{\"orders\":{\"totalElements\":5,\"limit\":10,\"offset\":0,\"hasMore\":false}}");

        when(mockNamedJdbc.query(eq("SELECT 1"), anyMap(), any(org.springframework.jdbc.core.RowMapper.class)))
                .thenAnswer(invocation -> {
                    org.springframework.jdbc.core.RowMapper<CompositeRecordResponse> mapper = invocation.getArgument(2);
                    return List.of(mapper.mapRow(rs, 0));
                });

        CompositeRecordResponse result = serviceWithJdbc.getCompositeRecordById(100L, 1L, Collections.emptyMap());
        assertNotNull(result);
        assertEquals("dynamic-sql-pushdown", result.engineUsed());
        assertEquals("Acme Corp", result.attributes().get("companyName"));
        assertTrue(result.childPagination().containsKey("orders"));
        verify(mockJdbc).execute(CompositeRecordService.TIMEOUT_STATEMENT);
    }

    @Test
    void getCompositeRecordById_WithPushdownException_FallsBackToDataLoader() {
        org.springframework.jdbc.core.JdbcTemplate mockJdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate mockNamedJdbc =
                mock(org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate.class);

        CompositeRecordService serviceWithJdbc = new CompositeRecordService(
                entityTypeRepository,
                entityRecordRepository,
                dynamicQueryCompiler,
                dataLoaderBatchResolver,
                objectMapper,
                pageBuilder,
                mockJdbc,
                mockNamedJdbc
        );

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(100L)).thenReturn(Optional.of(compositeEntityType));
        when(dynamicQueryCompiler.compileSingleRecordQueryWithOptions(any(), anyString(), anyLong(), anyMap()))
                .thenReturn(new DynamicQueryCompiler.CompiledQuery("SELECT 1", Map.of(), null, null));

        when(mockNamedJdbc.query(anyString(), anyMap(), any(org.springframework.jdbc.core.RowMapper.class)))
                .thenThrow(new org.springframework.dao.QueryTimeoutException("Statement timed out (>1500ms)"));

        EntityRecord root = new EntityRecord();
        root.setId(1L);
        root.setTenantId("tenant-test");
        root.setEntityType(compositeEntityType);
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1L))
                .thenReturn(Optional.of(root));

        CompositeRecordResponse fallbackResponse = new CompositeRecordResponse(
                1L, "tenant-test", 10L, true, 1L, Map.of(), Map.of(), "dataloader-fallback", null, null
        );
        when(dataLoaderBatchResolver.resolveBatch(eq(compositeSpec), anyList(), anyMap()))
                .thenReturn(List.of(fallbackResponse));

        CompositeRecordResponse result = serviceWithJdbc.getCompositeRecordById(100L, 1L, Collections.emptyMap());
        assertNotNull(result);
        assertEquals("dataloader-fallback", result.engineUsed());
        verify(dataLoaderBatchResolver, times(1)).resolveBatch(eq(compositeSpec), anyList(), anyMap());
    }

    @Test
    void getCompositeRecordsPage_WithPushdownSuccess_ReturnsPushdownPage() throws Exception {
        org.springframework.jdbc.core.JdbcTemplate mockJdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate mockNamedJdbc =
                mock(org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate.class);

        CompositeRecordService serviceWithJdbc = new CompositeRecordService(
                entityTypeRepository,
                entityRecordRepository,
                dynamicQueryCompiler,
                dataLoaderBatchResolver,
                objectMapper,
                pageBuilder,
                mockJdbc,
                mockNamedJdbc
        );

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(100L)).thenReturn(Optional.of(compositeEntityType));
        when(dynamicQueryCompiler.compilePaginatedQueryWithOptions(any(), anyString(), anyInt(), anyInt(), anyMap()))
                .thenReturn(new DynamicQueryCompiler.CompiledQuery("SELECT 1", Map.of(), "SELECT COUNT(*)", Map.of()));

        when(mockNamedJdbc.queryForObject(eq("SELECT COUNT(*)"), anyMap(), eq(Long.class))).thenReturn(1L);

        java.sql.ResultSet rs = mock(java.sql.ResultSet.class);
        when(rs.getLong("root_id")).thenReturn(1L);
        when(rs.getString("root_tenant_id")).thenReturn("tenant-test");
        when(rs.getLong("root_entity_type_id")).thenReturn(10L);
        when(rs.getString("composite_document")).thenReturn("invalid-json");
        when(rs.getString("child_pagination_metadata")).thenReturn(null);

        when(mockNamedJdbc.query(eq("SELECT 1"), anyMap(), any(org.springframework.jdbc.core.RowMapper.class)))
                .thenAnswer(invocation -> {
                    org.springframework.jdbc.core.RowMapper<CompositeRecordResponse> mapper = invocation.getArgument(2);
                    return List.of(mapper.mapRow(rs, 0));
                });

        PageRequest req = new PageRequest();
        req.setNumber(1);
        req.setSize(10);
        Page<CompositeRecordResponse> expectedMockPage = new Page<>();
        doReturn(expectedMockPage).when(pageBuilder).build(eq(req), any(), any());

        Page<CompositeRecordResponse> result = serviceWithJdbc.getCompositeRecordsPage(100L, req, Collections.emptyMap());
        assertNotNull(result);
        verify(mockNamedJdbc).queryForObject(eq("SELECT COUNT(*)"), anyMap(), eq(Long.class));
    }

    @Test
    void getCompositeRecordsPage_WithPushdownException_FallsBackToDataLoader() {
        org.springframework.jdbc.core.JdbcTemplate mockJdbc = mock(org.springframework.jdbc.core.JdbcTemplate.class);
        org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate mockNamedJdbc =
                mock(org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate.class);

        CompositeRecordService serviceWithJdbc = new CompositeRecordService(
                entityTypeRepository,
                entityRecordRepository,
                dynamicQueryCompiler,
                dataLoaderBatchResolver,
                objectMapper,
                pageBuilder,
                mockJdbc,
                mockNamedJdbc
        );

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(100L)).thenReturn(Optional.of(compositeEntityType));
        when(dynamicQueryCompiler.compilePaginatedQueryWithOptions(any(), anyString(), anyInt(), anyInt(), anyMap()))
                .thenReturn(new DynamicQueryCompiler.CompiledQuery("SELECT 1", Map.of(), "SELECT COUNT(*)", Map.of()));

        when(mockNamedJdbc.queryForObject(anyString(), anyMap(), eq(Long.class)))
                .thenThrow(new org.springframework.dao.QueryTimeoutException("Query timeout"));

        EntityRecord root = new EntityRecord();
        root.setId(1L);
        root.setTenantId("tenant-test");
        org.springframework.data.domain.Page<EntityRecord> springPage =
                new org.springframework.data.domain.PageImpl<>(List.of(root));
        when(entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(eq(10L), any()))
                .thenReturn(springPage);

        CompositeRecordResponse fallbackResponse = new CompositeRecordResponse(
                1L, "tenant-test", 10L, true, 1L, Map.of(), Map.of(), "dataloader-fallback", null, null
        );
        when(dataLoaderBatchResolver.resolveBatch(eq(compositeSpec), anyList(), anyMap()))
                .thenReturn(List.of(fallbackResponse));

        PageRequest req = new PageRequest();
        req.setNumber(1);
        req.setSize(10);
        Page<CompositeRecordResponse> expectedMockPage = new Page<>();
        doReturn(expectedMockPage).when(pageBuilder).build(eq(req), any(), any());

        Page<CompositeRecordResponse> result = serviceWithJdbc.getCompositeRecordsPage(100L, req, Collections.emptyMap());
        assertNotNull(result);
        verify(dataLoaderBatchResolver, times(1)).resolveBatch(eq(compositeSpec), anyList(), anyMap());
    }
}

