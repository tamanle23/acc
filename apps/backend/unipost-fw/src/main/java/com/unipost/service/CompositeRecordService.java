package com.unipost.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.core.io.Page;
import com.unipost.core.io.PageRequest;
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
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Slf4j
@Service
@Transactional(readOnly = true)
public class CompositeRecordService {

    public static final String TIMEOUT_STATEMENT = "SET LOCAL statement_timeout = '1500ms'";

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRecordRepository entityRecordRepository;
    private final DynamicQueryCompiler dynamicQueryCompiler;
    private final DataLoaderBatchResolver dataLoaderBatchResolver;
    private final ObjectMapper objectMapper;
    private final PageBuilder pageBuilder;
    private final JdbcTemplate jdbcTemplate;
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public CompositeRecordService(
            EntityTypeRepository entityTypeRepository,
            EntityRecordRepository entityRecordRepository,
            DynamicQueryCompiler dynamicQueryCompiler,
            DataLoaderBatchResolver dataLoaderBatchResolver,
            ObjectMapper objectMapper,
            PageBuilder pageBuilder,
            @Autowired(required = false) JdbcTemplate jdbcTemplate) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRecordRepository = entityRecordRepository;
        this.dynamicQueryCompiler = dynamicQueryCompiler;
        this.dataLoaderBatchResolver = dataLoaderBatchResolver;
        this.objectMapper = objectMapper;
        this.pageBuilder = pageBuilder;
        this.jdbcTemplate = jdbcTemplate;
        this.namedParameterJdbcTemplate = jdbcTemplate != null ? new NamedParameterJdbcTemplate(jdbcTemplate) : null;
    }

    /**
     * Resolves a single composite record document by record ID, with native child collection pagination.
     */
    public CompositeRecordResponse getCompositeRecordById(
            Long entityTypeId,
            Long recordId,
            Map<String, ChildPaginationParam> childParams) {

        EntityType entityType = getActiveCompositeEntityType(entityTypeId);
        CompositeSpec spec = entityType.getCompositeSpec();
        String tenantId = getEffectiveTenantId();

        // 1. Try single-roundtrip Dynamic SQL Pushdown
        if (namedParameterJdbcTemplate != null) {
            try {
                enforceStatementTimeout();
                DynamicQueryCompiler.CompiledQuery compiled = dynamicQueryCompiler.compileSingleRecordQuery(
                        spec, tenantId, recordId, childParams
                );

                List<CompositeRecordResponse> results = namedParameterJdbcTemplate.query(
                        compiled.sql(),
                        compiled.parameters(),
                        (rs, rowNum) -> mapRowToCompositeRecord(rs)
                );

                if (!results.isEmpty()) {
                    return results.get(0);
                }
            } catch (Exception e) {
                log.warn("Dynamic SQL pushdown failed or timed out for composite record {} (type {}), falling back to DataLoader: {}",
                        recordId, entityTypeId, e.getMessage());
            }
        }

        // 2. Resilient fallback to DataLoaderBatchResolver
        EntityRecord rootRecord = entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(spec.rootEntityTypeId(), recordId)
                .orElseThrow(() -> new MetadataNotFoundException(
                        "Root EntityRecord not found with id: " + recordId + " for composite entity type: " + entityTypeId));

        List<CompositeRecordResponse> fallbackBatch = dataLoaderBatchResolver.resolveBatch(
                spec, List.of(rootRecord), childParams
        );

        if (fallbackBatch.isEmpty()) {
            throw new MetadataNotFoundException("Composite record could not be resolved for id: " + recordId);
        }
        return fallbackBatch.get(0);
    }

    /**
     * Resolves a root-paginated page of composite record documents with native child collection pagination.
     */
    public Page<CompositeRecordResponse> getCompositeRecordsPage(
            Long entityTypeId,
            PageRequest pageRequest,
            Map<String, ChildPaginationParam> childParams) {

        EntityType entityType = getActiveCompositeEntityType(entityTypeId);
        CompositeSpec spec = entityType.getCompositeSpec();
        String tenantId = getEffectiveTenantId();

        int pageNum = (pageRequest != null && pageRequest.getNumber() != null) ? pageRequest.getNumber() : 1;
        int pageSize = (pageRequest != null && pageRequest.getSize() > 0) ? pageRequest.getSize() : 10;
        int offset = (pageNum - 1) * pageSize;

        // 1. Try single-roundtrip Dynamic SQL Pushdown
        if (namedParameterJdbcTemplate != null) {
            try {
                enforceStatementTimeout();
                DynamicQueryCompiler.CompiledQuery compiled = dynamicQueryCompiler.compilePaginatedQuery(
                        spec, tenantId, pageSize, offset, childParams
                );

                Long totalCount = namedParameterJdbcTemplate.queryForObject(
                        compiled.countSql(),
                        compiled.countParameters(),
                        Long.class
                );

                List<CompositeRecordResponse> records = namedParameterJdbcTemplate.query(
                        compiled.sql(),
                        compiled.parameters(),
                        (rs, rowNum) -> mapRowToCompositeRecord(rs)
                );

                return pageBuilder.build(
                        pageRequest,
                        () -> totalCount != null ? totalCount : 0L,
                        () -> records
                );
            } catch (Exception e) {
                log.warn("Dynamic SQL pushdown query failed or timed out for composite type {}, falling back to DataLoader: {}",
                        entityTypeId, e.getMessage());
            }
        }

        // 2. Resilient fallback to DataLoaderBatchResolver
        org.springframework.data.domain.Pageable springPageable = org.springframework.data.domain.PageRequest.of(pageNum - 1, pageSize);
        org.springframework.data.domain.Page<EntityRecord> rootPage =
                entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(spec.rootEntityTypeId(), springPageable);

        List<CompositeRecordResponse> resolved = dataLoaderBatchResolver.resolveBatch(
                spec, rootPage.getContent(), childParams
        );

        return pageBuilder.build(
                pageRequest,
                rootPage::getTotalElements,
                () -> resolved
        );
    }

    private void enforceStatementTimeout() {
        if (jdbcTemplate != null) {
            try {
                jdbcTemplate.execute(TIMEOUT_STATEMENT);
            } catch (Exception ignored) {}
        }
    }

    private CompositeRecordResponse mapRowToCompositeRecord(java.sql.ResultSet rs) throws java.sql.SQLException {
        Long rootId = rs.getLong("root_id");
        String rootTenantId = rs.getString("root_tenant_id");
        Long rootEntityTypeId = rs.getLong("root_entity_type_id");
        Long rootSchemaVersion = rs.getLong("root_schema_version");
        java.sql.Timestamp createdTs = rs.getTimestamp("root_created_date");
        java.sql.Timestamp updatedTs = rs.getTimestamp("root_updated_date");

        String docJson = rs.getString("composite_document");
        String paginationJson = rs.getString("child_pagination_metadata");

        Map<String, Object> attributes;
        try {
            attributes = objectMapper.readValue(docJson, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            log.error("Failed to deserialize composite_document JSON for root record {}: {}", rootId, e.getMessage());
            attributes = Collections.emptyMap();
        }

        Map<String, ChildPaginationMetadata> childPaginationMeta;
        try {
            if (paginationJson != null && !paginationJson.isBlank()) {
                childPaginationMeta = objectMapper.readValue(paginationJson, new TypeReference<Map<String, ChildPaginationMetadata>>() {});
            } else {
                childPaginationMeta = Collections.emptyMap();
            }
        } catch (Exception e) {
            log.warn("Failed to deserialize child_pagination_metadata for root record {}: {}", rootId, e.getMessage());
            childPaginationMeta = Collections.emptyMap();
        }

        return new CompositeRecordResponse(
                rootId,
                rootTenantId,
                rootEntityTypeId,
                true,
                rootSchemaVersion != null ? rootSchemaVersion : 1L,
                attributes,
                childPaginationMeta,
                "dynamic-sql-pushdown",
                createdTs != null ? createdTs.toLocalDateTime() : null,
                updatedTs != null ? updatedTs.toLocalDateTime() : null
        );
    }

    private EntityType getActiveCompositeEntityType(Long entityTypeId) {
        EntityType et = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        if (!Boolean.TRUE.equals(et.getIsComposite()) || et.getCompositeSpec() == null) {
            throw new IllegalArgumentException("Entity type " + entityTypeId + " ('" + et.getName() + "') is not a composite entity type or lacks a CompositeSpec.");
        }
        return et;
    }

    private String getEffectiveTenantId() {
        String tenantId = TenantContextHolder.getTenantId();
        return (tenantId != null && !tenantId.isBlank()) ? tenantId : "tenant-acme";
    }
}
