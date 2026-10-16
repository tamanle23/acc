package com.unipost.service;

import com.unipost.domain.metadata.CompositeField;
import com.unipost.domain.metadata.CompositeJoinPattern;
import com.unipost.domain.metadata.CompositeNode;
import com.unipost.domain.metadata.CompositeSpec;
import com.unipost.presentation.dto.metadata.ChildPaginationParam;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * DynamicQueryCompiler compiles CompositeSpec ASTs into single-roundtrip PostgreSQL
 * queries using jsonb_build_object, jsonb_agg, and LEFT JOIN LATERAL with child collection pagination.
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
     * Compiles a single-record query by root ID.
     */
    public CompiledQuery compileSingleRecordQuery(
            CompositeSpec spec,
            String tenantId,
            Long recordId,
            Map<String, ChildPaginationParam> childParams) {
        return compileQueryInternal(spec, tenantId, recordId, null, null, childParams);
    }

    /**
     * Compiles a root-paginated query across all records of this composite entity type.
     */
    public CompiledQuery compilePaginatedQuery(
            CompositeSpec spec,
            String tenantId,
            int limit,
            int offset,
            Map<String, ChildPaginationParam> childParams) {
        return compileQueryInternal(spec, tenantId, null, limit, offset, childParams);
    }

    private CompiledQuery compileQueryInternal(
            CompositeSpec spec,
            String tenantId,
            Long recordId,
            Integer rootLimit,
            Integer rootOffset,
            Map<String, ChildPaginationParam> childParams) {

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

        if (spec.children() != null && !spec.children().isEmpty()) {
            for (CompositeNode child : spec.children()) {
                compileChildNodeHierarchy(child, "root", 1, tableAliasSeq, joins, params, childParams);
            }
        }

        // Project child collection references in root document
        for (ChildJoinMetadata join : joins) {
            if (join.parentTableAlias().equals("root")) {
                sql.append("    '").append(join.nodeAlias()).append("', ")
                   .append(join.joinTableAlias()).append(".aggregated_data,\n");
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

        // Append all LATERAL joins
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
            Map<String, Object> params,
            Map<String, ChildPaginationParam> childParams) {

        if (currentDepth > MAX_DEPTH_CEILING) {
            throw new IllegalArgumentException("Composite specification recursion exceeds maximum allowed depth of " + MAX_DEPTH_CEILING);
        }

        int seq = aliasSeq.getAndIncrement();
        String joinTableAlias = "t_child_" + seq;
        String nodeAlias = node.effectiveAlias();

        ChildPaginationParam pagination = (childParams != null && childParams.containsKey(nodeAlias))
                ? childParams.get(nodeAlias)
                : ChildPaginationParam.ofDefault();

        String limitParam = "childLimit_" + seq;
        String offsetParam = "childOffset_" + seq;
        String typeParam = "childType_" + seq;

        params.put(limitParam, pagination.limit());
        params.put(offsetParam, pagination.offset());
        params.put(typeParam, node.targetEntityTypeId());

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

            appendJoinCondition(node, parentTableAlias, typeParam, lateralSql, seq, params);
            lateralSql.append("  LIMIT 1\n");
        } else {
            // ONE_TO_MANY or default list with native windowed pagination & true total count
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
            lateralSql.append("           ROW_NUMBER() OVER (ORDER BY c.id ASC) AS row_num,\n");
            lateralSql.append("           COUNT(*) OVER () AS total_rows\n");
            lateralSql.append("    FROM UNIPOST_ENTITIES c\n");

            appendJoinCondition(node, parentTableAlias, typeParam, lateralSql, seq, params);
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
                compileChildNodeHierarchy(grandchild, joinTableAlias, currentDepth + 1, aliasSeq, joins, params, childParams);
            }
        }
    }

    private void appendJoinCondition(
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
    }

    private record ChildJoinMetadata(
            String nodeAlias,
            String parentTableAlias,
            String joinTableAlias,
            String limitParamName,
            String offsetParamName,
            String lateralJoinSql
    ) {}
}
