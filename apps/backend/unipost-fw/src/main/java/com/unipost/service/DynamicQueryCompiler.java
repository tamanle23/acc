package com.unipost.service;

import com.unipost.domain.metadata.CompositeField;
import com.unipost.domain.metadata.CompositeJoinPattern;
import com.unipost.domain.metadata.CompositeNode;
import com.unipost.domain.metadata.CompositeRollup;
import com.unipost.domain.metadata.CompositeSpec;
import com.unipost.presentation.dto.metadata.ChildFilterCriteria;
import com.unipost.presentation.dto.metadata.ChildPaginationParam;
import com.unipost.presentation.dto.metadata.ChildQueryOptions;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * DynamicQueryCompiler compiles CompositeSpec ASTs into single-roundtrip PostgreSQL
 * queries using jsonb_build_object, jsonb_agg, companion unpaginated lateral rollups,
 * and LEFT JOIN LATERAL with child collection pagination, filtering, and sorting.
 */
@Slf4j
@Component
public class DynamicQueryCompiler {

    public static final int MAX_DEPTH_CEILING = 4;
    public static final int DEFAULT_CHILD_LIMIT = 50;

    public record CompiledQuery(
            String sql,
            Map<String, Object> parameters,
            String countSql,
            Map<String, Object> countParameters
    ) {}

    /**
     * Compiles a single-record query by root ID with ChildPaginationParam.
     */
    public CompiledQuery compileSingleRecordQuery(
            CompositeSpec spec,
            String tenantId,
            Long recordId,
            Map<String, ChildPaginationParam> childParams) {
        return compileSingleRecordQueryWithOptions(spec, tenantId, recordId, toQueryOptions(childParams));
    }

    /**
     * Compiles a single-record query by root ID with ChildQueryOptions (filters, sorts, limits).
     */
    public CompiledQuery compileSingleRecordQueryWithOptions(
            CompositeSpec spec,
            String tenantId,
            Long recordId,
            Map<String, ChildQueryOptions> childQueries) {
        return compileQueryInternal(spec, tenantId, recordId, null, null, childQueries);
    }

    /**
     * Compiles a root-paginated query across all records of this composite entity type with ChildPaginationParam.
     */
    public CompiledQuery compilePaginatedQuery(
            CompositeSpec spec,
            String tenantId,
            int limit,
            int offset,
            Map<String, ChildPaginationParam> childParams) {
        return compilePaginatedQueryWithOptions(spec, tenantId, limit, offset, toQueryOptions(childParams));
    }

    /**
     * Compiles a root-paginated query across all records with ChildQueryOptions (filters, sorts, limits).
     */
    public CompiledQuery compilePaginatedQueryWithOptions(
            CompositeSpec spec,
            String tenantId,
            int limit,
            int offset,
            Map<String, ChildQueryOptions> childQueries) {
        return compileQueryInternal(spec, tenantId, null, limit, offset, childQueries);
    }

    private static Map<String, ChildQueryOptions> toQueryOptions(Map<String, ChildPaginationParam> childParams) {
        if (childParams == null || childParams.isEmpty()) {
            return Collections.emptyMap();
        }
        Map<String, ChildQueryOptions> options = new HashMap<>();
        for (Map.Entry<String, ChildPaginationParam> entry : childParams.entrySet()) {
            options.put(entry.getKey(), new ChildQueryOptions(
                    entry.getValue().limit(),
                    entry.getValue().offset(),
                    null,
                    null
            ));
        }
        return options;
    }

    private CompiledQuery compileQueryInternal(
            CompositeSpec spec,
            String tenantId,
            Long recordId,
            Integer rootLimit,
            Integer rootOffset,
            Map<String, ChildQueryOptions> childQueries) {

        if (spec == null) {
            throw new IllegalArgumentException("CompositeSpec cannot be null");
        }

        Map<String, Object> params = new HashMap<>();
        Map<String, Object> countParams = new HashMap<>();

        params.put("tenantId", tenantId);
        countParams.put("tenantId", tenantId);

        params.put("rootEntityTypeId", spec.rootEntityTypeId());
        countParams.put("rootEntityTypeId", spec.rootEntityTypeId());

        if (recordId != null) {
            params.put("rootRecordId", recordId);
        }

        StringBuilder sql = new StringBuilder();
        StringBuilder countSql = new StringBuilder();

        // 1. Count query
        countSql.append("SELECT COUNT(*) FROM UNIPOST_ENTITIES root\n");
        countSql.append("WHERE root.entity_type_id = :rootEntityTypeId\n");
        countSql.append("  AND root.tenant_id = :tenantId\n");
        countSql.append("  AND root.\"deletedDate\" IS NULL\n");

        // 2. Main query projection
        sql.append("SELECT\n");
        sql.append("  root.id AS root_id,\n");
        sql.append("  root.tenant_id AS root_tenant_id,\n");
        sql.append("  root.entity_type_id AS root_entity_type_id,\n");
        sql.append("  root.schema_version AS root_schema_version,\n");
        sql.append("  root.\"createdDate\" AS root_created_date,\n");
        sql.append("  root.\"lastUpdatedDate\" AS root_updated_date,\n");

        // Build root composite document
        sql.append("  jsonb_build_object(\n");
        sql.append("    'id', root.id,\n");
        sql.append("    'tenantId', root.tenant_id,\n");
        sql.append("    'entityTypeId', root.entity_type_id,\n");
        sql.append("    'is_composite', TRUE,\n");

        // Root fields
        if (spec.fields() != null) {
            for (CompositeField field : spec.fields()) {
                String alias = field.effectiveAlias();
                sql.append("    '").append(alias).append("', root.attributes->>'")
                   .append(field.sourceAttribute()).append("',\n");
            }
        }

        AtomicInteger tableAliasSeq = new AtomicInteger(1);
        List<ChildJoinMetadata> joins = new ArrayList<>();
        List<RollupJoinMetadata> rollupJoins = new ArrayList<>();

        if (spec.children() != null && !spec.children().isEmpty()) {
            for (CompositeNode child : spec.children()) {
                compileChildNodeHierarchy(child, "root", 1, tableAliasSeq, joins, rollupJoins, params, childQueries, spec.rollups());
            }
        }

        // Project child collection references in root document
        for (ChildJoinMetadata join : joins) {
            if (join.parentTableAlias().equals("root")) {
                sql.append("    '").append(join.nodeAlias()).append("', ")
                   .append(join.joinTableAlias()).append(".aggregated_data,\n");
            }
        }

        // Project computed rollups in root document
        for (RollupJoinMetadata rJoin : rollupJoins) {
            if (rJoin.parentTableAlias().equals("root")) {
                for (RollupFieldMeta rField : rJoin.fields()) {
                    sql.append("    '").append(rField.alias()).append("', ")
                       .append(rJoin.joinTableAlias()).append(".").append(rField.alias()).append(",\n");
                }
            }
        }

        // Clean up trailing comma
        int lastComma = sql.lastIndexOf(",\n");
        if (lastComma > 0) {
            sql.replace(lastComma, lastComma + 2, "\n");
        }
        sql.append("  ) AS composite_document,\n");

        // Build child pagination metadata JSON
        sql.append("  jsonb_build_object(\n");
        if (!joins.isEmpty()) {
            for (ChildJoinMetadata join : joins) {
                if (join.parentTableAlias().equals("root")) {
                    sql.append("    '").append(join.nodeAlias()).append("', jsonb_build_object(\n");
                    sql.append("      'totalElements', COALESCE(").append(join.joinTableAlias()).append(".total_count, 0),\n");
                    sql.append("      'limit', :").append(join.limitParamName()).append(",\n");
                    sql.append("      'offset', :").append(join.offsetParamName()).append(",\n");
                    sql.append("      'hasMore', (COALESCE(").append(join.joinTableAlias()).append(".total_count, 0) > (:")
                       .append(join.offsetParamName()).append(" + :").append(join.limitParamName()).append("))\n");
                    sql.append("    ),\n");
                }
            }
            int metaComma = sql.lastIndexOf(",\n");
            if (metaComma > 0) {
                sql.replace(metaComma, metaComma + 2, "\n");
            }
        }
        sql.append("  ) AS child_pagination_metadata\n");

        // FROM clause
        sql.append("FROM UNIPOST_ENTITIES root\n");

        // Append all companion rollup LATERAL joins
        for (RollupJoinMetadata rJoin : rollupJoins) {
            sql.append(rJoin.lateralJoinSql());
        }

        // Append all child data LATERAL joins
        for (ChildJoinMetadata join : joins) {
            sql.append(join.lateralJoinSql());
        }

        // Root WHERE clause
        sql.append("WHERE root.entity_type_id = :rootEntityTypeId\n");
        sql.append("  AND root.tenant_id = :tenantId\n");
        sql.append("  AND root.\"deletedDate\" IS NULL\n");

        if (recordId != null) {
            sql.append("  AND root.id = :rootRecordId\n");
        }

        sql.append("ORDER BY root.id ASC\n");

        if (rootLimit != null && rootOffset != null) {
            params.put("rootLimit", rootLimit);
            params.put("rootOffset", rootOffset);
            sql.append("LIMIT :rootLimit OFFSET :rootOffset\n");
        }

        return new CompiledQuery(sql.toString(), params, countSql.toString(), countParams);
    }

    private void compileChildNodeHierarchy(
            CompositeNode node,
            String parentTableAlias,
            int currentDepth,
            AtomicInteger aliasSeq,
            List<ChildJoinMetadata> joins,
            List<RollupJoinMetadata> rollupJoins,
            Map<String, Object> params,
            Map<String, ChildQueryOptions> childQueries,
            List<CompositeRollup> parentRollups) {

        if (currentDepth > MAX_DEPTH_CEILING) {
            throw new IllegalArgumentException("Composite specification recursion exceeds maximum allowed depth of " + MAX_DEPTH_CEILING);
        }

        int seq = aliasSeq.getAndIncrement();
        String joinTableAlias = "t_child_" + seq;
        String nodeAlias = node.effectiveAlias();

        ChildQueryOptions options = (childQueries != null && childQueries.containsKey(nodeAlias))
                ? childQueries.get(nodeAlias)
                : new ChildQueryOptions(DEFAULT_CHILD_LIMIT, 0, null, null);

        int limit = options.effectiveLimit();
        int offset = options.effectiveOffset();

        String limitParam = "childLimit_" + seq;
        String offsetParam = "childOffset_" + seq;
        String typeParam = "childType_" + seq;

        params.put(limitParam, limit);
        params.put(offsetParam, offset);
        params.put(typeParam, node.targetEntityTypeId());

        // 1. Compile companion unpaginated rollup aggregation if any rollups target this node
        List<CompositeRollup> matchingRollups = new ArrayList<>();
        if (parentRollups != null) {
            for (CompositeRollup r : parentRollups) {
                if (nodeAlias.equalsIgnoreCase(r.targetNodeAlias())) {
                    matchingRollups.add(r);
                }
            }
        }
        if (node.rollups() != null) {
            for (CompositeRollup r : node.rollups()) {
                if (nodeAlias.equalsIgnoreCase(r.targetNodeAlias())) {
                    matchingRollups.add(r);
                }
            }
        }

        if (!matchingRollups.isEmpty()) {
            compileRollupCompanionLateral(node, parentTableAlias, typeParam, seq, rollupJoins, params, matchingRollups);
        }

        // 2. Compile paginated child slice lateral subquery
        StringBuilder lateralSql = new StringBuilder();
        boolean isOneToOne = "ONE_TO_ONE".equalsIgnoreCase(node.cardinality());

        lateralSql.append("LEFT JOIN LATERAL (\n");

        if (isOneToOne) {
            lateralSql.append("  SELECT\n");
            lateralSql.append("    jsonb_build_object(\n");
            lateralSql.append("      'id', c.id,\n");
            lateralSql.append("      'tenantId', c.tenant_id,\n");
            lateralSql.append("      'entityTypeId', c.entity_type_id,\n");
            if (node.fields() != null) {
                for (CompositeField f : node.fields()) {
                    lateralSql.append("      '").append(f.effectiveAlias()).append("', c.attributes->>'")
                              .append(f.sourceAttribute()).append("',\n");
                }
            }
            int oneComma = lateralSql.lastIndexOf(",\n");
            if (oneComma > 0) lateralSql.replace(oneComma, oneComma + 2, "\n");
            lateralSql.append("    ) AS aggregated_data,\n");
            lateralSql.append("    1 AS total_count\n");
            lateralSql.append("  FROM UNIPOST_ENTITIES c\n");

            appendJoinCondition(node, parentTableAlias, typeParam, lateralSql, seq, params, options);
            lateralSql.append("  LIMIT 1\n");
        } else {
            // ONE_TO_MANY or default list with native windowed pagination & true total count
            String sortOrderClause = resolveSortClause(options);

            lateralSql.append("  SELECT\n");
            lateralSql.append("    COALESCE(jsonb_agg(\n");
            lateralSql.append("      jsonb_build_object(\n");
            lateralSql.append("        'id', sub.id,\n");
            lateralSql.append("        'tenantId', sub.tenant_id,\n");
            lateralSql.append("        'entityTypeId', sub.entity_type_id,\n");
            if (node.fields() != null) {
                for (CompositeField f : node.fields()) {
                    lateralSql.append("        '").append(f.effectiveAlias()).append("', sub.attributes->>'")
                              .append(f.sourceAttribute()).append("',\n");
                }
            }
            int manyComma = lateralSql.lastIndexOf(",\n");
            if (manyComma > 0) lateralSql.replace(manyComma, manyComma + 2, "\n");
            lateralSql.append("      )\n");
            lateralSql.append("    ) FILTER (WHERE sub.row_num > :").append(offsetParam)
                      .append(" AND sub.row_num <= (:").append(offsetParam).append(" + :").append(limitParam).append(")), '[]'::jsonb) AS aggregated_data,\n");
            lateralSql.append("    COALESCE(MAX(sub.total_rows), 0) AS total_count\n");
            lateralSql.append("  FROM (\n");
            lateralSql.append("    SELECT c.*,\n");
            lateralSql.append("           ROW_NUMBER() OVER (").append(sortOrderClause).append(") AS row_num,\n");
            lateralSql.append("           COUNT(*) OVER () AS total_rows\n");
            lateralSql.append("    FROM UNIPOST_ENTITIES c\n");

            appendJoinCondition(node, parentTableAlias, typeParam, lateralSql, seq, params, options);
            lateralSql.append("  ) sub\n");
        }

        lateralSql.append(") ").append(joinTableAlias).append(" ON TRUE\n");

        joins.add(new ChildJoinMetadata(
                nodeAlias,
                parentTableAlias,
                joinTableAlias,
                limitParam,
                offsetParam,
                lateralSql.toString()
        ));

        // Recursive children if any
        if (node.children() != null && !node.children().isEmpty()) {
            for (CompositeNode grandchild : node.children()) {
                compileChildNodeHierarchy(grandchild, joinTableAlias, currentDepth + 1, aliasSeq, joins, rollupJoins, params, childQueries, node.rollups());
            }
        }
    }

    private void compileRollupCompanionLateral(
            CompositeNode node,
            String parentTableAlias,
            String typeParam,
            int seq,
            List<RollupJoinMetadata> rollupJoins,
            Map<String, Object> params,
            List<CompositeRollup> rollups) {

        String rollupTableAlias = "t_rollup_" + seq;
        StringBuilder rSql = new StringBuilder();
        List<RollupFieldMeta> fields = new ArrayList<>();

        rSql.append("LEFT JOIN LATERAL (\n");
        rSql.append("  SELECT\n");

        for (int i = 0; i < rollups.size(); i++) {
            CompositeRollup r = rollups.get(i);
            String rAlias = r.effectiveAlias();
            String targetField = r.targetField();
            String func = (r.aggregateFunction() != null) ? r.aggregateFunction().name() : "COUNT";

            fields.add(new RollupFieldMeta(rAlias));
            rSql.append("    ");

            if ("COUNT".equalsIgnoreCase(func)) {
                if (r.filterPredicate() != null && !r.filterPredicate().isBlank()) {
                    rSql.append("COALESCE(COUNT(CASE WHEN ").append(sanitizePredicate(r.filterPredicate()))
                        .append(" THEN 1 END), 0)");
                } else {
                    rSql.append("COUNT(*)");
                }
            } else if ("SUM".equalsIgnoreCase(func)) {
                if (targetField != null && targetField.matches("^[a-zA-Z0-9_]+$")) {
                    rSql.append("COALESCE(SUM((c_agg.attributes->>'").append(targetField).append("')::numeric), 0)");
                } else {
                    rSql.append("0");
                }
            } else if ("AVG".equalsIgnoreCase(func)) {
                if (targetField != null && targetField.matches("^[a-zA-Z0-9_]+$")) {
                    rSql.append("COALESCE(AVG((c_agg.attributes->>'").append(targetField).append("')::numeric), 0)");
                } else {
                    rSql.append("0");
                }
            } else if ("MIN".equalsIgnoreCase(func)) {
                if (targetField != null && targetField.matches("^[a-zA-Z0-9_]+$")) {
                    rSql.append("MIN((c_agg.attributes->>'").append(targetField).append("')::numeric)");
                } else {
                    rSql.append("NULL");
                }
            } else if ("MAX".equalsIgnoreCase(func)) {
                if (targetField != null && targetField.matches("^[a-zA-Z0-9_]+$")) {
                    rSql.append("MAX((c_agg.attributes->>'").append(targetField).append("')::numeric)");
                } else {
                    rSql.append("NULL");
                }
            } else {
                rSql.append("COUNT(*)");
            }

            rSql.append(" AS ").append(rAlias);
            if (i < rollups.size() - 1) {
                rSql.append(",\n");
            } else {
                rSql.append("\n");
            }
        }

        rSql.append("  FROM UNIPOST_ENTITIES c_agg\n");
        appendJoinConditionForRollup(node, parentTableAlias, typeParam, rSql, seq, params);
        rSql.append(") ").append(rollupTableAlias).append(" ON TRUE\n");

        rollupJoins.add(new RollupJoinMetadata(
                parentTableAlias,
                rollupTableAlias,
                fields,
                rSql.toString()
        ));
    }

    private String sanitizePredicate(String predicate) {
        // Simple safety sanitization for filter predicates in rollups (e.g. status = 'ACTIVE')
        if (predicate == null || predicate.isBlank()) return "TRUE";
        String clean = predicate.trim().replace(";", "").replace("--", "");
        return "c_agg.attributes->>'" + clean.replace("=", "') =");
    }

    private String resolveSortClause(ChildQueryOptions options) {
        if (options == null || options.sort() == null || options.sort().isBlank()) {
            return "ORDER BY c.id ASC";
        }
        String[] parts = options.sort().trim().split(":");
        String sortCol = parts[0].trim();
        String direction = (parts.length > 1 && "desc".equalsIgnoreCase(parts[1].trim())) ? "DESC" : "ASC";

        if (sortCol.matches("^[a-zA-Z0-9_]+$")) {
            if ("id".equalsIgnoreCase(sortCol)) {
                return "ORDER BY c.id " + direction;
            } else if ("createdDate".equalsIgnoreCase(sortCol) || "created_date".equalsIgnoreCase(sortCol)) {
                return "ORDER BY c.\"createdDate\" " + direction + ", c.id ASC";
            } else {
                return "ORDER BY (c.attributes->>'" + sortCol + "') " + direction + ", c.id ASC";
            }
        }
        return "ORDER BY c.id ASC";
    }

    private void appendJoinCondition(
            CompositeNode node,
            String parentTableAlias,
            String typeParam,
            StringBuilder sql,
            int seq,
            Map<String, Object> params,
            ChildQueryOptions options) {

        if (node.effectiveJoinPattern() == CompositeJoinPattern.PATTERN_B_FOREIGN_KEY) {
            String fkAttr = node.foreignKeyAttribute() != null && !node.foreignKeyAttribute().isBlank()
                    ? node.foreignKeyAttribute().trim()
                    : "root_id";
            sql.append("  WHERE c.entity_type_id = :").append(typeParam).append("\n");
            sql.append("    AND c.tenant_id = ").append(parentTableAlias).append(".tenant_id\n");
            sql.append("    AND c.\"deletedDate\" IS NULL\n");
            sql.append("    AND (c.attributes->>'").append(fkAttr).append("') = ").append(parentTableAlias).append(".id::text\n");
        } else {
            // Pattern C: Association matrix via UNIPOST_ENTITY_RELATIONSHIPS
            String relParam = "relType_" + seq;
            sql.append("  INNER JOIN UNIPOST_ENTITY_RELATIONSHIPS rel ON rel.target_entity_id = c.id\n");
            sql.append("  WHERE c.tenant_id = ").append(parentTableAlias).append(".tenant_id\n");
            sql.append("    AND c.\"deletedDate\" IS NULL\n");
            sql.append("    AND rel.source_entity_id = ").append(parentTableAlias).append(".id\n");
            sql.append("    AND rel.\"deletedDate\" IS NULL\n");
            if (node.relationshipTypeId() != null) {
                params.put(relParam, node.relationshipTypeId());
                sql.append("    AND rel.relationship_type_id = :").append(relParam).append("\n");
            }
        }

        // Dynamic child filters injection
        if (options != null && options.filters() != null && !options.filters().isEmpty()) {
            for (Map.Entry<String, Object> entry : options.filters().entrySet()) {
                String filterKey = entry.getKey();
                if (!filterKey.matches("^[a-zA-Z0-9_]+$")) {
                    continue; // Skip invalid identifiers
                }
                Object filterObj = entry.getValue();
                String op = "eq";
                Object val = filterObj;

                if (filterObj instanceof Map<?, ?> filterMap) {
                    if (filterMap.get("op") != null) op = filterMap.get("op").toString().toLowerCase();
                    if (filterMap.get("value") != null) val = filterMap.get("value");
                } else if (filterObj instanceof ChildFilterCriteria criteria) {
                    op = criteria.effectiveOp();
                    val = criteria.value();
                }

                String paramName = "childFilter_" + seq + "_" + filterKey;
                if ("like".equals(op) || "contains".equals(op)) {
                    params.put(paramName, "%" + (val != null ? val.toString() : "") + "%");
                    sql.append("    AND (c.attributes->>'").append(filterKey).append("') ILIKE :").append(paramName).append("\n");
                } else if ("gte".equals(op)) {
                    params.put(paramName, val);
                    sql.append("    AND (c.attributes->>'").append(filterKey).append("')::numeric >= :").append(paramName).append("\n");
                } else if ("lte".equals(op)) {
                    params.put(paramName, val);
                    sql.append("    AND (c.attributes->>'").append(filterKey).append("')::numeric <= :").append(paramName).append("\n");
                } else {
                    // Default equality
                    params.put(paramName, val != null ? val.toString() : "");
                    sql.append("    AND (c.attributes->>'").append(filterKey).append("') = :").append(paramName).append("\n");
                }
            }
        }
    }

    private void appendJoinConditionForRollup(
            CompositeNode node,
            String parentTableAlias,
            String typeParam,
            StringBuilder sql,
            int seq,
            Map<String, Object> params) {

        if (node.effectiveJoinPattern() == CompositeJoinPattern.PATTERN_B_FOREIGN_KEY) {
            String fkAttr = node.foreignKeyAttribute() != null && !node.foreignKeyAttribute().isBlank()
                    ? node.foreignKeyAttribute().trim()
                    : "root_id";
            sql.append("  WHERE c_agg.entity_type_id = :").append(typeParam).append("\n");
            sql.append("    AND c_agg.tenant_id = ").append(parentTableAlias).append(".tenant_id\n");
            sql.append("    AND c_agg.\"deletedDate\" IS NULL\n");
            sql.append("    AND (c_agg.attributes->>'").append(fkAttr).append("') = ").append(parentTableAlias).append(".id::text\n");
        } else {
            String relParam = "relType_r_" + seq;
            sql.append("  INNER JOIN UNIPOST_ENTITY_RELATIONSHIPS rel ON rel.target_entity_id = c_agg.id\n");
            sql.append("  WHERE c_agg.tenant_id = ").append(parentTableAlias).append(".tenant_id\n");
            sql.append("    AND c_agg.\"deletedDate\" IS NULL\n");
            sql.append("    AND rel.source_entity_id = ").append(parentTableAlias).append(".id\n");
            sql.append("    AND rel.\"deletedDate\" IS NULL\n");
            if (node.relationshipTypeId() != null) {
                params.put(relParam, node.relationshipTypeId());
                sql.append("    AND rel.relationship_type_id = :").append(relParam).append("\n");
            }
        }
    }

    private record RollupFieldMeta(String alias) {}

    private record RollupJoinMetadata(
            String parentTableAlias,
            String joinTableAlias,
            List<RollupFieldMeta> fields,
            String lateralJoinSql
    ) {}

    private record ChildJoinMetadata(
            String nodeAlias,
            String parentTableAlias,
            String joinTableAlias,
            String limitParamName,
            String offsetParamName,
            String lateralJoinSql
    ) {}
}
