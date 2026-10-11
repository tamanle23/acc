package com.unipost.tenant.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.unipost.domain.metadata.AttributeDefinition;
import com.unipost.domain.metadata.EntityRecord;
import com.unipost.domain.metadata.EntityType;
import com.unipost.repository.jpa.AttributeDefinitionRepository;
import com.unipost.repository.jpa.EntityRecordRepository;
import com.unipost.repository.jpa.EntityRelationshipRepository;
import com.unipost.repository.jpa.EntityTypeRepository;
import com.unipost.repository.jpa.RelationshipTypeRepository;
import com.unipost.service.SchemaCompiler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TenantExportServiceTest {

    @Mock
    private EntityTypeRepository entityTypeRepository;
    @Mock
    private AttributeDefinitionRepository attributeDefinitionRepository;
    @Mock
    private RelationshipTypeRepository relationshipTypeRepository;
    @Mock
    private EntityRecordRepository entityRecordRepository;
    @Mock
    private EntityRelationshipRepository entityRelationshipRepository;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new com.fasterxml.jackson.datatype.jsr310.JavaTimeModule())
            .disable(com.fasterxml.jackson.databind.SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private SchemaCompiler schemaCompiler;
    private TenantExportService exportService;

    @BeforeEach
    void setUp() {
        schemaCompiler = new SchemaCompiler(objectMapper);
        exportService = new TenantExportService(
                entityTypeRepository,
                attributeDefinitionRepository,
                relationshipTypeRepository,
                entityRecordRepository,
                entityRelationshipRepository,
                objectMapper
        );
        exportService.setSchemaCompiler(schemaCompiler);
    }

    @Test
    @DisplayName("GDPR Art. 20 Streaming ZIP export writes complete bundle structure, Draft-07 schemas, JSONL/CSV records, and SHA-256 manifest")
    void testStreamingExportCreatesValidZip() throws IOException {
        String tenantId = "test-export-tenant";

        EntityType entityType = new EntityType();
        entityType.setId(1L);
        entityType.setSystemName("article");
        entityType.setName("Article");
        entityType.setTenantId(tenantId);
        entityType.setSchemaVersion(1L);

        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(10L);
        attr.setEntityType(entityType);
        attr.setSystemName("title");
        attr.setName("Title");
        attr.setDataType("string");
        attr.setUiComponent("text");
        attr.setIsRequired(true);
        attr.setTenantId(tenantId);

        EntityRecord record = new EntityRecord();
        record.setId(100L);
        record.setTenantId(tenantId);
        record.setEntityType(entityType);
        record.setCreatedDate(LocalDateTime.of(2026, 10, 11, 12, 0));
        record.setAttributes(Map.of("title", "Hello World, GDPR"));

        when(entityTypeRepository.findByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(List.of(entityType));
        when(attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(List.of(attr));
        when(relationshipTypeRepository.findByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(List.of());

        when(entityRecordRepository.countByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(1L);
        when(entityRelationshipRepository.countByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(0L);

        when(entityRecordRepository.findByEntityTypeIdAndTenantIdAndDeletedDateIsNull(eq(1L), eq(tenantId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(record)));
        when(entityRecordRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of(record)));
        when(entityRelationshipRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        exportService.streamTenantArchive(tenantId, baos);

        byte[] zipBytes = baos.toByteArray();
        assertTrue(zipBytes.length > 0, "ZIP bytes must not be empty");

        // Inspect ZIP contents
        Map<String, String> entries = new HashMap<>();
        try (ZipInputStream zis = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                ByteArrayOutputStream entryContent = new ByteArrayOutputStream();
                byte[] buffer = new byte[1024];
                int len;
                while ((len = zis.read(buffer)) > 0) {
                    entryContent.write(buffer, 0, len);
                }
                entries.put(entry.getName(), entryContent.toString(StandardCharsets.UTF_8));
                zis.closeEntry();
            }
        }

        // Validate presence of required bundle files according to Phase 18 spec
        assertTrue(entries.containsKey("manifest.json"), "Must contain manifest.json");
        assertTrue(entries.containsKey("schemas/entity_types.json"), "Must contain schemas/entity_types.json");
        assertTrue(entries.containsKey("schemas/attribute_definitions.json"), "Must contain schemas/attribute_definitions.json");
        assertTrue(entries.containsKey("schemas/relationship_types.json"), "Must contain schemas/relationship_types.json");
        assertTrue(entries.containsKey("schemas/article.schema.json"), "Must contain schemas/article.schema.json");
        assertTrue(entries.containsKey("records/article.jsonl"), "Must contain records/article.jsonl");
        assertTrue(entries.containsKey("records/article.csv"), "Must contain records/article.csv");
        assertTrue(entries.containsKey("data/records.ndjson"), "Must contain data/records.ndjson");
        assertTrue(entries.containsKey("data/entity_relationships.ndjson"), "Must contain data/entity_relationships.ndjson");
        assertTrue(entries.containsKey("media/assets.json"), "Must contain media/assets.json");

        // Validate manifest JSON content and SHA-256 digest
        String manifestJson = entries.get("manifest.json");
        assertTrue(manifestJson.contains("\"tenantId\" : \"test-export-tenant\""));
        assertTrue(manifestJson.contains("\"sha256Digest\" :"));
        assertTrue(manifestJson.contains("\"entityTypesCount\" : 1"));
        assertTrue(manifestJson.contains("\"recordsCount\" : 1"));

        // Validate Draft-07 compiled schema
        String articleSchemaJson = entries.get("schemas/article.schema.json");
        assertTrue(articleSchemaJson.contains("http://json-schema.org/draft-07/schema#"));

        // Validate CSV output formatting
        String articleCsv = entries.get("records/article.csv");
        assertTrue(articleCsv.contains("id,createdDate,lastUpdatedDate,title"));
        assertTrue(articleCsv.contains("\"Hello World, GDPR\""));
    }

    @Test
    @DisplayName("Streaming export 50,000 records pipeline executes with zero JVM Heap OOM (< 256MB memory delta)")
    void testLargeVolumeStreamingExportMemoryBounds() throws IOException {
        String tenantId = "large-export-tenant";

        EntityType entityType = new EntityType();
        entityType.setId(1L);
        entityType.setSystemName("order");
        entityType.setName("Order");
        entityType.setTenantId(tenantId);
        entityType.setSchemaVersion(1L);

        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(20L);
        attr.setEntityType(entityType);
        attr.setSystemName("total_amount");
        attr.setName("Total Amount");
        attr.setDataType("number");
        attr.setUiComponent("number");
        attr.setTenantId(tenantId);

        when(entityTypeRepository.findByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(List.of(entityType));
        when(attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(List.of(attr));
        when(relationshipTypeRepository.findByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(List.of());

        int totalRecordsCount = 50000;
        int pageSize = 1000;
        int totalPages = totalRecordsCount / pageSize;

        when(entityRecordRepository.countByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn((long) totalRecordsCount);
        when(entityRelationshipRepository.countByTenantIdAndDeletedDateIsNull(tenantId))
                .thenReturn(0L);

        // Mock repository paging across 50 pages of 1000 records each
        when(entityRecordRepository.findByEntityTypeIdAndTenantIdAndDeletedDateIsNull(eq(1L), eq(tenantId), any(PageRequest.class)))
                .thenAnswer(invocation -> {
                    PageRequest pr = invocation.getArgument(2);
                    int page = pr.getPageNumber();
                    List<EntityRecord> records = new ArrayList<>(pageSize);
                    for (int i = 0; i < pageSize; i++) {
                        EntityRecord r = new EntityRecord();
                        r.setId((long) (page * pageSize + i + 1));
                        r.setTenantId(tenantId);
                        r.setEntityType(entityType);
                        r.setAttributes(Map.of("total_amount", 99.99 + i));
                        records.add(r);
                    }
                    return new PageImpl<>(records, pr, totalRecordsCount);
                });

        when(entityRecordRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenAnswer(invocation -> {
                    PageRequest pr = invocation.getArgument(1);
                    int page = pr.getPageNumber();
                    List<EntityRecord> records = new ArrayList<>(pageSize);
                    for (int i = 0; i < pageSize; i++) {
                        EntityRecord r = new EntityRecord();
                        r.setId((long) (page * pageSize + i + 1));
                        r.setTenantId(tenantId);
                        r.setEntityType(entityType);
                        r.setAttributes(Map.of("total_amount", 99.99 + i));
                        records.add(r);
                    }
                    return new PageImpl<>(records, pr, totalRecordsCount);
                });

        when(entityRelationshipRepository.findByTenantIdAndDeletedDateIsNull(eq(tenantId), any(PageRequest.class)))
                .thenReturn(new PageImpl<>(List.of()));

        // Stream into a discarded output stream to measure GC/memory footprint
        OutputStream nullOutputStream = new OutputStream() {
            @Override
            public void write(int b) {}
            @Override
            public void write(byte[] b, int off, int len) {}
        };

        System.gc();
        long beforeMemory = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();

        exportService.streamTenantArchive(tenantId, nullOutputStream);

        long afterMemory = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
        long memoryDelta = Math.max(0, afterMemory - beforeMemory);

        // Memory delta assertion with threshold under 256MB per Phase 18 specification
        assertTrue(memoryDelta < 256 * 1024 * 1024,
                "Memory delta for 50,000 records streaming export must be under 256MB (Actual delta: " + (memoryDelta / (1024 * 1024)) + "MB)");
    }
}
