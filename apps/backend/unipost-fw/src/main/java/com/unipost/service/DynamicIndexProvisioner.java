package com.unipost.service;

import com.unipost.domain.metadata.CompositeField;
import com.unipost.domain.metadata.CompositeJoinPattern;
import com.unipost.domain.metadata.CompositeNode;
import com.unipost.domain.metadata.CompositeSpec;
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
