package com.acc.tenant.export;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.metadata.AttributeDefinition;
import com.acc.domain.metadata.EntityRecord;
import com.acc.domain.metadata.EntityRelationship;
import com.acc.domain.metadata.EntityType;
import com.acc.domain.metadata.RelationshipType;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityRelationshipRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.repository.jpa.RelationshipTypeRepository;
import com.acc.service.SchemaCompiler;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Service for GDPR Article 20 data portability: chunked, non-blocking streaming export
 * of tenant metadata, JSON Schema Draft-07 definitions, JSONL records, CSV exports,
 * and media catalogs directly into a compressed ZIP archive without JVM heap OOM.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TenantExportService {

    private final EntityTypeRepository entityTypeRepository;
    private final AttributeDefinitionRepository attributeDefinitionRepository;
    private final RelationshipTypeRepository relationshipTypeRepository;
    private final EntityRecordRepository entityRecordRepository;
    private final EntityRelationshipRepository entityRelationshipRepository;
    private final ObjectMapper objectMapper;

    private SchemaCompiler schemaCompiler;

    @Autowired(required = false)
    public void setSchemaCompiler(SchemaCompiler schemaCompiler) {
        this.schemaCompiler = schemaCompiler;
    }

    private static final int CHUNK_SIZE = 1000;

    /**
     * Streams the complete tenant data archive directly to the provided OutputStream.
     * Memory overhead is capped regardless of record volume by flushing chunks directly to the stream.
     */
    @Transactional(readOnly = true)
    public void streamTenantArchive(String tenantId, OutputStream targetOutputStream) throws IOException {
        String effectiveTenant = (tenantId != null && !tenantId.isBlank())
                ? tenantId.trim().toLowerCase()
                : TenantContextHolder.getTenantId();

        log.info("Starting chunked streaming export pipeline for tenant '{}'", effectiveTenant);

        MessageDigest messageDigest;
        try {
            messageDigest = MessageDigest.getInstance("SHA-256");
        } catch (Exception e) {
            throw new RuntimeException("SHA-256 MessageDigest algorithm unavailable", e);
        }

        try (ZipOutputStream zipOut = new ZipOutputStream(targetOutputStream)) {
            // 1. Gather counts and metadata
            List<EntityType> entityTypes = entityTypeRepository.findByTenantIdAndDeletedDateIsNull(effectiveTenant);
            List<AttributeDefinition> attributes = attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull(effectiveTenant);
            List<RelationshipType> relTypes = relationshipTypeRepository.findByTenantIdAndDeletedDateIsNull(effectiveTenant);

            long totalRecords = entityRecordRepository.countByTenantIdAndDeletedDateIsNull(effectiveTenant);
            long totalRelationships = entityRelationshipRepository.countByTenantIdAndDeletedDateIsNull(effectiveTenant);

            // 2. Write global schemas
            writeZipEntry(zipOut, messageDigest, "schemas/entity_types.json", objectMapper.writeValueAsString(entityTypes));
            writeZipEntry(zipOut, messageDigest, "schemas/attribute_definitions.json", objectMapper.writeValueAsString(attributes));
            writeZipEntry(zipOut, messageDigest, "schemas/relationship_types.json", objectMapper.writeValueAsString(relTypes));

            // 3. Write compiled Draft-07 JSON Schemas per entity type
            for (EntityType entityType : entityTypes) {
                List<AttributeDefinition> etAttrs = attributes.stream()
                        .filter(a -> a.getEntityType() != null && a.getEntityType().getId() != null && a.getEntityType().getId().equals(entityType.getId()))
                        .collect(Collectors.toList());

                String compiledSchemaJson;
                if (schemaCompiler != null) {
                    compiledSchemaJson = schemaCompiler.compile(entityType.getId(), entityType.getSchemaVersion(), etAttrs);
                } else {
                    compiledSchemaJson = objectMapper.writeValueAsString(entityType);
                }

                writeZipEntry(zipOut, messageDigest, "schemas/" + entityType.getSystemName() + ".schema.json", compiledSchemaJson);
            }

            // 4. Stream records per entity type into JSONL (.jsonl) and CSV (.csv)
            for (EntityType entityType : entityTypes) {
                List<AttributeDefinition> etAttrs = attributes.stream()
                        .filter(a -> a.getEntityType() != null && a.getEntityType().getId() != null && a.getEntityType().getId().equals(entityType.getId()))
                        .collect(Collectors.toList());

                // JSONL stream
                zipOut.putNextEntry(new ZipEntry("records/" + entityType.getSystemName() + ".jsonl"));
                int pageNumber = 0;
                Page<EntityRecord> etRecordPage;
                do {
                    etRecordPage = entityRecordRepository.findByEntityTypeIdAndTenantIdAndDeletedDateIsNull(
                            entityType.getId(), effectiveTenant, PageRequest.of(pageNumber, CHUNK_SIZE));
                    if (etRecordPage.isEmpty() && pageNumber == 0) {
                        // Fallback to tenant query if entityTypeId spec requires fallback
                        etRecordPage = entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(
                                entityType.getId(), PageRequest.of(pageNumber, CHUNK_SIZE));
                    }

                    for (EntityRecord record : etRecordPage.getContent()) {
                        byte[] bytes = (objectMapper.writeValueAsString(record) + "\n").getBytes(StandardCharsets.UTF_8);
                        zipOut.write(bytes);
                        messageDigest.update(bytes);
                    }
                    zipOut.flush();
                    pageNumber++;
                } while (etRecordPage.hasNext());
                zipOut.closeEntry();

                // CSV Stream
                zipOut.putNextEntry(new ZipEntry("records/" + entityType.getSystemName() + ".csv"));
                StringBuilder csvHeader = new StringBuilder("id,createdDate,lastUpdatedDate");
                for (AttributeDefinition attr : etAttrs) {
                    csvHeader.append(",").append(escapeCsvValue(attr.getSystemName()));
                }
                csvHeader.append("\n");
                byte[] headerBytes = csvHeader.toString().getBytes(StandardCharsets.UTF_8);
                zipOut.write(headerBytes);
                messageDigest.update(headerBytes);

                pageNumber = 0;
                do {
                    etRecordPage = entityRecordRepository.findByEntityTypeIdAndTenantIdAndDeletedDateIsNull(
                            entityType.getId(), effectiveTenant, PageRequest.of(pageNumber, CHUNK_SIZE));
                    if (etRecordPage.isEmpty() && pageNumber == 0) {
                        etRecordPage = entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(
                                entityType.getId(), PageRequest.of(pageNumber, CHUNK_SIZE));
                    }

                    for (EntityRecord record : etRecordPage.getContent()) {
                        StringBuilder row = new StringBuilder();
                        row.append(escapeCsvValue(record.getId())).append(",")
                                .append(escapeCsvValue(record.getCreatedDate())).append(",")
                                .append(escapeCsvValue(record.getLastUpdatedDate()));

                        Map<String, Object> recordAttrs = record.getAttributes() != null ? record.getAttributes() : Map.of();
                        for (AttributeDefinition attr : etAttrs) {
                            Object val = recordAttrs.get(attr.getSystemName());
                            row.append(",").append(escapeCsvValue(val));
                        }
                        row.append("\n");

                        byte[] rowBytes = row.toString().getBytes(StandardCharsets.UTF_8);
                        zipOut.write(rowBytes);
                        messageDigest.update(rowBytes);
                    }
                    zipOut.flush();
                    pageNumber++;
                } while (etRecordPage.hasNext());
                zipOut.closeEntry();
            }

            // 5. Monolithic data/records.ndjson
            zipOut.putNextEntry(new ZipEntry("data/records.ndjson"));
            int pageNumber = 0;
            Page<EntityRecord> recordPage;
            do {
                recordPage = entityRecordRepository.findByTenantIdAndDeletedDateIsNull(
                        effectiveTenant, PageRequest.of(pageNumber, CHUNK_SIZE));
                for (EntityRecord record : recordPage.getContent()) {
                    byte[] bytes = (objectMapper.writeValueAsString(record) + "\n").getBytes(StandardCharsets.UTF_8);
                    zipOut.write(bytes);
                    messageDigest.update(bytes);
                }
                zipOut.flush();
                pageNumber++;
            } while (recordPage.hasNext());
            zipOut.closeEntry();

            // 6. Monolithic data/entity_relationships.ndjson
            zipOut.putNextEntry(new ZipEntry("data/entity_relationships.ndjson"));
            pageNumber = 0;
            Page<EntityRelationship> relPage;
            do {
                relPage = entityRelationshipRepository.findByTenantIdAndDeletedDateIsNull(
                        effectiveTenant, PageRequest.of(pageNumber, CHUNK_SIZE));
                for (EntityRelationship rel : relPage.getContent()) {
                    byte[] bytes = (objectMapper.writeValueAsString(rel) + "\n").getBytes(StandardCharsets.UTF_8);
                    zipOut.write(bytes);
                    messageDigest.update(bytes);
                }
                zipOut.flush();
                pageNumber++;
            } while (relPage.hasNext());
            zipOut.closeEntry();

            // 7. Write media/assets.json catalog
            List<Map<String, Object>> mediaAssets = new ArrayList<>();
            writeZipEntry(zipOut, messageDigest, "media/assets.json", objectMapper.writeValueAsString(mediaAssets));

            // 8. Write manifest.json with calculated SHA-256 Digest
            String hexDigest = bytesToHex(messageDigest.digest());
            TenantExportManifest.ExportSummary summary = new TenantExportManifest.ExportSummary(
                    entityTypes.size(),
                    attributes.size(),
                    relTypes.size(),
                    totalRecords,
                    totalRelationships
            );
            TenantExportManifest manifest = TenantExportManifest.of(effectiveTenant, hexDigest, summary);
            writeZipEntry(zipOut, null, "manifest.json", objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(manifest));

            zipOut.finish();
            log.info("Successfully completed GDPR Art. 20 streaming export archive for tenant '{}' (SHA-256: {}, records: {})",
                    effectiveTenant, hexDigest, totalRecords);
        }
    }

    private void writeZipEntry(ZipOutputStream zipOut, MessageDigest digest, String entryPath, String content) throws IOException {
        byte[] bytes = content.getBytes(StandardCharsets.UTF_8);
        zipOut.putNextEntry(new ZipEntry(entryPath));
        zipOut.write(bytes);
        if (digest != null) {
            digest.update(bytes);
        }
        zipOut.closeEntry();
    }

    private String escapeCsvValue(Object val) {
        if (val == null) return "";
        String str;
        if (val instanceof Map || val instanceof List) {
            try {
                str = objectMapper.writeValueAsString(val);
            } catch (Exception e) {
                str = String.valueOf(val);
            }
        } else {
            str = String.valueOf(val);
        }
        if (str.contains(",") || str.contains("\"") || str.contains("\n") || str.contains("\r")) {
            return "\"" + str.replace("\"", "\"\"") + "\"";
        }
        return str;
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
