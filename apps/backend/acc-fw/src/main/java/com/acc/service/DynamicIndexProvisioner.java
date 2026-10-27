package com.acc.service;

import com.acc.domain.metadata.CompositeField;
import com.acc.domain.metadata.CompositeJoinPattern;
import com.acc.domain.metadata.CompositeNode;
import com.acc.domain.metadata.CompositeSpec;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Slf4j
@Component
@RequiredArgsConstructor
public class DynamicIndexProvisioner {

    private final JdbcTemplate jdbcTemplate;
    private final ExecutorService indexExecutor = createThreadExecutor();

    private static ExecutorService createThreadExecutor() {
        try {
            java.lang.reflect.Method m = Executors.class.getMethod("newVirtualThreadPerTaskExecutor");
            return (ExecutorService) m.invoke(null);
        } catch (Exception e) {
            return Executors.newCachedThreadPool();
        }
    }

    /**
     * Inspects a CompositeSpec and generates partial B-Tree functional index DDLs.
     * Pattern B foreign keys and projected filter keys get partial functional indexes.
     */
    public List<String> generateIndexStatements(CompositeSpec spec) {
        List<String> ddlStatements = new ArrayList<>();
        if (spec == null) return ddlStatements;

        // 1. Partial indexes for root projected fields
        if (spec.rootEntityTypeId() != null && spec.fields() != null) {
            for (CompositeField field : spec.fields()) {
                String attr = field.sourceAttribute();
                if (attr != null && !attr.isBlank() && !attr.equalsIgnoreCase("id")) {
                    String cleanAttr = attr.replaceAll("[^a-zA-Z0-9_]", "");
                    String indexName = "idx_comp_root_" + spec.rootEntityTypeId() + "_" + cleanAttr;
                    String ddl = String.format(
                        "CREATE INDEX CONCURRENTLY IF NOT EXISTS %s ON UNIPOST_ENTITIES ((attributes->>'%s')) WHERE (entity_type_id = %d AND \"deletedDate\" IS NULL);",
                        indexName, attr, spec.rootEntityTypeId()
                    );
                    ddlStatements.add(ddl);
                }
            }
        }

        // 2. Partial indexes for Pattern B foreign keys in children
        if (spec.children() != null) {
            for (CompositeNode child : spec.children()) {
                collectChildIndexStatements(child, ddlStatements);
            }
        }

        return ddlStatements;
    }

    private void collectChildIndexStatements(CompositeNode node, List<String> ddlStatements) {
        if (node.effectiveJoinPattern() == CompositeJoinPattern.PATTERN_B_FOREIGN_KEY 
                && node.targetEntityTypeId() != null 
                && node.foreignKeyAttribute() != null) {
            String fk = node.foreignKeyAttribute();
            String cleanFk = fk.replaceAll("[^a-zA-Z0-9_]", "");
            String indexName = "idx_comp_b_fk_" + node.targetEntityTypeId() + "_" + cleanFk;
            String ddl = String.format(
                "CREATE INDEX CONCURRENTLY IF NOT EXISTS %s ON UNIPOST_ENTITIES ((attributes->>'%s')) WHERE (entity_type_id = %d AND \"deletedDate\" IS NULL);",
                indexName, fk, node.targetEntityTypeId()
            );
            ddlStatements.add(ddl);
        }

        if (node.children() != null) {
            for (CompositeNode grandchild : node.children()) {
                collectChildIndexStatements(grandchild, ddlStatements);
            }
        }
    }

    /**
     * Generates a PostgreSQL JSONB expression index statement for an AttributeDefinition.
     */
    public String generateAttributeIndexStatement(Long entityTypeId, String systemName, String dataType) {
        if (entityTypeId == null || systemName == null || systemName.isBlank()) {
            return null;
        }

        String cleanAttr = systemName.replaceAll("[^a-zA-Z0-9_]", "");
        String indexName = "idx_ent_attr_" + entityTypeId + "_" + cleanAttr;
        String typeUpper = dataType != null ? dataType.trim().toUpperCase() : "STRING";

        String expr;
        if ("NUMERIC".equals(typeUpper) || "NUMBER".equals(typeUpper) || "INTEGER".equals(typeUpper)) {
            expr = "((attributes->>'" + cleanAttr + "')::numeric)";
        } else if ("DATE".equals(typeUpper) || "DATETIME".equals(typeUpper) || "TIMESTAMP".equals(typeUpper)) {
            expr = "((attributes->>'" + cleanAttr + "')::timestamp)";
        } else {
            expr = "(attributes->>'" + cleanAttr + "')";
        }

        return String.format(
            "CREATE INDEX CONCURRENTLY IF NOT EXISTS %s ON UNIPOST_ENTITIES (%s) WHERE (entity_type_id = %d AND \"deletedDate\" IS NULL);",
            indexName, expr, entityTypeId
        );
    }

    /**
     * Asynchronously provisions a PostgreSQL functional expression index for a single entity attribute.
     */
    public void provisionAttributeIndexAsync(Long entityTypeId, String systemName, String dataType) {
        String ddl = generateAttributeIndexStatement(entityTypeId, systemName, dataType);
        if (ddl == null) return;

        indexExecutor.submit(() -> {
            try {
                log.info("Executing asynchronous attribute functional index provisioning: {}", ddl);
                if (jdbcTemplate != null) {
                    jdbcTemplate.execute(ddl);
                }
            } catch (Exception e) {
                log.warn("Async attribute functional index creation skipped or encountered warning: {}", e.getMessage());
            }
        });
    }

    /**
     * Executes index provisioning on a dedicated background thread outside active transactions.
     */
    public void provisionIndexesAsync(CompositeSpec spec) {
        List<String> ddlStatements = generateIndexStatements(spec);
        if (ddlStatements.isEmpty()) return;

        indexExecutor.submit(() -> {
            for (String ddl : ddlStatements) {
                try {
                    log.info("Executing asynchronous partial functional index provisioning: {}", ddl);
                    if (jdbcTemplate != null) {
                        jdbcTemplate.execute(ddl);
                    }
                } catch (Exception e) {
                    log.warn("Async partial functional index creation skipped or encountered warning: {}", e.getMessage());
                }
            }
        });
    }
}
