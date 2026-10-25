package com.acc.sandbox.seed;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.metadata.EntityType;
import com.acc.domain.metadata.RelationshipType;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.repository.jpa.RelationshipTypeRepository;
import com.acc.sandbox.config.SandboxProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.*;

/**
 * High-performance, high-volume CMS data scaffolding generator for the Dynamic Metadata Engine.
 * Generates 1,000 to 5,000 articles, categories, and media assets with graph relationships
 * via chunked JDBC batch insertion for optimal startup performance and strict PostgreSQL RLS compliance.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "application.sandbox", name = "enabled", havingValue = "true")
public class CmsDataScaffoldingGenerator {

    private final SandboxProperties properties;
    private final ObjectProvider<JdbcTemplate> jdbcTemplateProvider;
    private final ObjectProvider<EntityTypeRepository> entityTypeRepositoryProvider;
    private final ObjectProvider<RelationshipTypeRepository> relationshipTypeRepositoryProvider;
    private final ObjectMapper objectMapper;

    public CmsDataScaffoldingGenerator(
            SandboxProperties properties,
            ObjectProvider<JdbcTemplate> jdbcTemplateProvider,
            ObjectProvider<EntityTypeRepository> entityTypeRepositoryProvider,
            ObjectProvider<RelationshipTypeRepository> relationshipTypeRepositoryProvider,
            ObjectMapper objectMapper
    ) {
        this.properties = properties;
        this.jdbcTemplateProvider = jdbcTemplateProvider;
        this.entityTypeRepositoryProvider = entityTypeRepositoryProvider;
        this.relationshipTypeRepositoryProvider = relationshipTypeRepositoryProvider;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void scaffoldCmsDataIfMissing() {
        SandboxProperties.SeedProperties seedProps = properties.getSeed();
        if (seedProps == null || !seedProps.isEnabled()) {
            log.info("[SANDBOX-CMS-SEED] High-volume CMS scaffolding disabled in configuration.");
            return;
        }

        JdbcTemplate jdbcTemplate = jdbcTemplateProvider.getIfAvailable();
        EntityTypeRepository entityTypeRepo = entityTypeRepositoryProvider.getIfAvailable();
        RelationshipTypeRepository relTypeRepo = relationshipTypeRepositoryProvider.getIfAvailable();

        if (jdbcTemplate == null || entityTypeRepo == null || relTypeRepo == null) {
            log.warn("[SANDBOX-CMS-SEED] Required repositories or JdbcTemplate unavailable; skipping CMS scaffolding.");
            return;
        }

        String tenantId = seedProps.getTenantId();

        // 1. Set Local Tenant Session for PostgreSQL Row-Level Security
        try {
            jdbcTemplate.execute("SET LOCAL app.current_tenant_id = '" + tenantId + "'");
        } catch (Exception e) {
            log.warn("[SANDBOX-CMS-SEED] Could not set local tenant id session setting: {}", e.getMessage());
        }

        // 2. Resolve Entity Types
        Optional<EntityType> articleTypeOpt = entityTypeRepo.findByTenantIdAndSystemNameAndDeletedDateIsNull(tenantId, "ent_cms_article");
        Optional<EntityType> categoryTypeOpt = entityTypeRepo.findByTenantIdAndSystemNameAndDeletedDateIsNull(tenantId, "ent_cms_category");
        Optional<EntityType> mediaTypeOpt = entityTypeRepo.findByTenantIdAndSystemNameAndDeletedDateIsNull(tenantId, "ent_cms_media_asset");

        if (articleTypeOpt.isEmpty() || categoryTypeOpt.isEmpty() || mediaTypeOpt.isEmpty()) {
            log.warn("[SANDBOX-CMS-SEED] CMS entity types not found for tenant '{}'. Ensure bp_cms_publishing_v1 is provisioned first.", tenantId);
            return;
        }

        EntityType articleType = articleTypeOpt.get();
        EntityType categoryType = categoryTypeOpt.get();
        EntityType mediaType = mediaTypeOpt.get();

        // Check if data already seeded
        Integer existingCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM UNIPOST_ENTITIES WHERE entity_type_id = ? AND tenant_id = ? AND \"deletedDate\" IS NULL",
                Integer.class,
                articleType.getId(),
                tenantId
        );

        if (existingCount != null && existingCount > 0) {
            log.info("[SANDBOX-CMS-SEED] CMS data already exists (found {} articles for tenant '{}'); skipping generation.", existingCount, tenantId);
            return;
        }

        long startTime = System.currentTimeMillis();
        log.info("[SANDBOX-CMS-SEED] Starting high-volume CMS data scaffolding for tenant '{}'...", tenantId);

        // 3. Seed Categories
        int categoriesCount = Math.max(10, seedProps.getCategoriesCount());
        List<Long> categoryIds = seedCategories(jdbcTemplate, categoryType, tenantId, categoriesCount);

        // 4. Seed Media Assets
        int mediaCount = Math.max(20, seedProps.getMediaAssetsCount());
        List<Long> mediaIds = seedMediaAssets(jdbcTemplate, mediaType, tenantId, mediaCount);

        // 5. Seed Articles
        int articlesCount = Math.max(100, seedProps.getArticlesCount());
        List<Long> articleIds = seedArticles(jdbcTemplate, articleType, tenantId, articlesCount);

        // 6. Seed Entity Relationships
        List<RelationshipType> relTypes = relTypeRepo.findByTenantIdAndDeletedDateIsNull(tenantId);
        Optional<RelationshipType> relArticleCategoryOpt = relTypes.stream()
                .filter(rt -> "rel_article_primary_category".equals(rt.getSystemName()))
                .findFirst();
        Optional<RelationshipType> relArticleMediaOpt = relTypes.stream()
                .filter(rt -> "rel_article_cover_media".equals(rt.getSystemName()))
                .findFirst();

        int relCount = 0;
        if (relArticleCategoryOpt.isPresent() && !categoryIds.isEmpty()) {
            relCount += seedRelationships(jdbcTemplate, relArticleCategoryOpt.get(), tenantId, articleIds, categoryIds, "Article Category Assignment");
        }
        if (relArticleMediaOpt.isPresent() && !mediaIds.isEmpty()) {
            relCount += seedRelationships(jdbcTemplate, relArticleMediaOpt.get(), tenantId, articleIds, mediaIds, "Article Cover Hero Asset");
        }

        long duration = System.currentTimeMillis() - startTime;
        log.info("[SANDBOX-CMS-SEED] Scaffolding complete in {}ms: {} categories, {} media assets, {} articles, and {} graph relationships created.",
                duration, categoryIds.size(), mediaIds.size(), articleIds.size(), relCount);
    }

    private List<Long> seedCategories(JdbcTemplate jdbcTemplate, EntityType type, String tenantId, int count) {
        String[] titles = {
                "Enterprise Architecture", "Cloud Native & DevOps", "Distributed Systems",
                "FinTech & VietQR", "AI Agents & Autonomous Coding", "Cybersecurity & Sovereign Tenancy",
                "Event-Driven Microservices", "PostgreSQL & RLS Mechanics", "Next.js & Frontend Vistas",
                "Mobile UI & Cross-Platform", "Big Data & Analytics", "Product Management"
        };

        List<Object[]> batchArgs = new ArrayList<>(count);
        List<String> uids = new ArrayList<>(count);
        Timestamp now = Timestamp.from(Instant.now());

        for (int i = 1; i <= count; i++) {
            String uid = UUID.randomUUID().toString();
            uids.add(uid);
            String title = titles[(i - 1) % titles.length] + (i > titles.length ? " Tier " + (i / titles.length + 1) : "");
            String slug = "category-" + i + "-" + title.toLowerCase().replaceAll("[^a-z0-9]+", "-");

            Map<String, Object> attrs = new LinkedHashMap<>();
            attrs.put("category_name", title);
            attrs.put("slug", slug);
            attrs.put("description", "High-frequency taxonomy section for " + title + " content streams and editorial articles.");

            String jsonPayload;
            try {
                jsonPayload = objectMapper.writeValueAsString(attrs);
            } catch (Exception e) {
                jsonPayload = "{}";
            }

            batchArgs.add(new Object[]{uid, type.getId(), tenantId, 1L, jsonPayload, now, now, 1L});
        }

        executeBatchInsertEntities(jdbcTemplate, batchArgs);
        return fetchIdsByUids(jdbcTemplate, uids);
    }

    private List<Long> seedMediaAssets(JdbcTemplate jdbcTemplate, EntityType type, String tenantId, int count) {
        String[] mediaTypes = {"IMAGE_WEBP", "IMAGE_JPEG", "IMAGE_PNG", "VIDEO_MP4", "DOCUMENT_PDF"};
        List<Object[]> batchArgs = new ArrayList<>(count);
        List<String> uids = new ArrayList<>(count);
        Timestamp now = Timestamp.from(Instant.now());

        for (int i = 1; i <= count; i++) {
            String uid = UUID.randomUUID().toString();
            uids.add(uid);
            String format = mediaTypes[i % mediaTypes.length];
            String ext = format.startsWith("IMAGE_") ? format.substring(6).toLowerCase() : (format.equals("VIDEO_MP4") ? "mp4" : "pdf");
            String fileName = "asset-" + String.format("%04d", i) + "." + ext;
            String cdnUrl = "https://cdn.sandbox.acc.io/assets/" + tenantId + "/" + fileName;

            Map<String, Object> attrs = new LinkedHashMap<>();
            attrs.put("asset_title", "Media Asset #" + i + " (" + format + ")");
            attrs.put("asset_url", cdnUrl);
            attrs.put("media_type", format);
            attrs.put("alt_text", "High resolution cover artwork and media illustration for digital publishing record #" + i);

            String jsonPayload;
            try {
                jsonPayload = objectMapper.writeValueAsString(attrs);
            } catch (Exception e) {
                jsonPayload = "{}";
            }

            batchArgs.add(new Object[]{uid, type.getId(), tenantId, 1L, jsonPayload, now, now, 1L});
        }

        executeBatchInsertEntities(jdbcTemplate, batchArgs);
        return fetchIdsByUids(jdbcTemplate, uids);
    }

    private List<Long> seedArticles(JdbcTemplate jdbcTemplate, EntityType type, String tenantId, int count) {
        String[] statuses = {"PUBLISHED", "DRAFT", "IN_REVIEW", "SCHEDULED", "ARCHIVED"};
        String[] topics = {
                "Architecting High-Throughput PostgreSQL Dynamic Schemas with RLS",
                "Building Liquid Glass Design Systems with Tailwind CSS and Radix UI",
                "Zero-Stub Multi-Tenancy Invariants in Spring Modulith Engines",
                "Decoupled Microservices vs Modular Monoliths: 2026 Production Retrospective",
                "Real-Time Event Streams and Outbox Reliability at Enterprise Scale",
                "VietQR Billing Automation and FinOps Settlement Webhooks",
                "Sovereign Custody Operations and DLQ Poison Pill Quarantine",
                "Autonomous AI Coding Pair-Programming in Complex Monorepos",
                "Deep Child Filtering and Windowed LATERAL Joins in Dynamic SQL Pushdown",
                "WCAG 2.2 AA Accessibility Enforcement Across Reactive UI Pipelines"
        };

        List<Object[]> batchArgs = new ArrayList<>(count);
        List<String> uids = new ArrayList<>(count);
        Timestamp now = Timestamp.from(Instant.now());

        for (int i = 1; i <= count; i++) {
            String uid = UUID.randomUUID().toString();
            uids.add(uid);
            String baseTopic = topics[(i - 1) % topics.length];
            String title = baseTopic + (i > topics.length ? " [Volume " + (i / topics.length + 1) + "]" : "");
            String slug = "article-" + i + "-" + title.toLowerCase().replaceAll("[^a-z0-9]+", "-").replaceAll("-$", "");
            String status = statuses[i % statuses.length];
            boolean featured = (i % 7 == 0);

            Map<String, Object> attrs = new LinkedHashMap<>();
            attrs.put("title", title);
            attrs.put("slug", slug);
            attrs.put("summary", "Executive editorial summary and technical walkthrough for " + title + ".");
            attrs.put("body_content", generateArticleMarkdown(title, i));
            attrs.put("status", status);
            attrs.put("featured_flag", featured);
            attrs.put("meta_title", title + " | Acc Media");
            attrs.put("meta_description", "Learn about " + baseTopic + " with real-world architecture case studies, benchmarks, and production guidelines.");

            String jsonPayload;
            try {
                jsonPayload = objectMapper.writeValueAsString(attrs);
            } catch (Exception e) {
                jsonPayload = "{}";
            }

            batchArgs.add(new Object[]{uid, type.getId(), tenantId, 1L, jsonPayload, now, now, 1L});
        }

        executeBatchInsertEntities(jdbcTemplate, batchArgs);
        return fetchIdsByUids(jdbcTemplate, uids);
    }

    private int seedRelationships(
            JdbcTemplate jdbcTemplate,
            RelationshipType relType,
            String tenantId,
            List<Long> sourceIds,
            List<Long> targetIds,
            String label
    ) {
        String sql = "INSERT INTO UNIPOST_ENTITY_RELATIONSHIPS (" +
                "uid, tenant_id, source_entity_id, target_entity_id, relationship_type_id, edge_metadata, \"createdDate\", \"lastUpdatedDate\", version" +
                ") VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)";

        List<Object[]> batchArgs = new ArrayList<>(sourceIds.size());
        Timestamp now = Timestamp.from(Instant.now());

        for (int i = 0; i < sourceIds.size(); i++) {
            Long sourceId = sourceIds.get(i);
            Long targetId = targetIds.get(i % targetIds.size());
            String uid = UUID.randomUUID().toString();

            Map<String, Object> meta = new LinkedHashMap<>();
            meta.put("label", label);
            meta.put("assigned_at", now.toString());
            meta.put("weight", (i % 10) + 1);

            String jsonPayload;
            try {
                jsonPayload = objectMapper.writeValueAsString(meta);
            } catch (Exception e) {
                jsonPayload = "{}";
            }

            batchArgs.add(new Object[]{uid, tenantId, sourceId, targetId, relType.getId(), jsonPayload, now, now, 1L});
        }

        // Execute chunked batch insert
        int chunkSize = 250;
        for (int i = 0; i < batchArgs.size(); i += chunkSize) {
            List<Object[]> chunk = batchArgs.subList(i, Math.min(i + chunkSize, batchArgs.size()));
            jdbcTemplate.batchUpdate(sql, chunk);
        }

        return batchArgs.size();
    }

    private void executeBatchInsertEntities(JdbcTemplate jdbcTemplate, List<Object[]> batchArgs) {
        String sql = "INSERT INTO UNIPOST_ENTITIES (" +
                "uid, entity_type_id, tenant_id, schema_version, attributes, \"createdDate\", \"lastUpdatedDate\", version" +
                ") VALUES (?, ?, ?, ?, ?::jsonb, ?, ?, ?)";

        int chunkSize = 250;
        for (int i = 0; i < batchArgs.size(); i += chunkSize) {
            List<Object[]> chunk = batchArgs.subList(i, Math.min(i + chunkSize, batchArgs.size()));
            jdbcTemplate.batchUpdate(sql, chunk);
        }
    }

    private List<Long> fetchIdsByUids(JdbcTemplate jdbcTemplate, List<String> uids) {
        if (uids.isEmpty()) return Collections.emptyList();

        List<Long> ids = new ArrayList<>(uids.size());
        int chunkSize = 500;
        for (int i = 0; i < uids.size(); i += chunkSize) {
            List<String> chunk = uids.subList(i, Math.min(i + chunkSize, uids.size()));
            String inSql = String.join(",", Collections.nCopies(chunk.size(), "?"));
            List<Long> chunkIds = jdbcTemplate.query(
                    "SELECT id FROM UNIPOST_ENTITIES WHERE uid IN (" + inSql + ") ORDER BY id ASC",
                    (rs, rowNum) -> rs.getLong("id"),
                    chunk.toArray()
            );
            ids.addAll(chunkIds);
        }
        return ids;
    }

    private String generateArticleMarkdown(String title, int index) {
        return "# " + title + "\n\n" +
                "## Introduction & Problem Context\n" +
                "In modern enterprise software engineering, building reliable metadata-driven architectures requires strict decoupling, " +
                "immutable versioning, and transparent tenant isolation. This article explores key technical challenges encountered during " +
                "the implementation of Phase " + (index % 50 + 1) + ".\n\n" +
                "### Architectural Invariants\n" +
                "- **Row-Level Security (RLS)**: Enforced directly inside PostgreSQL via session context variables (`SET LOCAL app.current_tenant_id`).\n" +
                "- **JSONB Hybrid Ingestion**: Allows dynamic user-defined fields without table-altering DDL operations.\n" +
                "- **Zero-Stub Prototyping**: Guarantees tests run against real database engines rather than synthetic in-memory pass-throughs.\n\n" +
                "```json\n" +
                "{\n" +
                "  \"record_id\": " + index + ",\n" +
                "  \"active\": true,\n" +
                "  \"cluster_nodes\": [\"node-1\", \"node-2\", \"node-3\"]\n" +
                "}\n" +
                "```\n\n" +
                "## Benchmark Observations\n" +
                "Our synthetic stress tests sustained **44,000 queries per second** with a p95 latency under 2.2ms across 1,000 concurrent database sessions.\n";
    }
}
