package com.unipost.service;

import com.unipost.domain.metadata.*;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.outbox.OutboxEventPublisher;
import com.unipost.presentation.dto.metadata.*;
import com.unipost.repository.jpa.*;
import com.unipost.service.exception.MetadataConflictException;
import com.unipost.service.exception.MetadataNotFoundException;
import com.unipost.service.workflow.EntityLifecycleService;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;

/**
 * Hardened 6-stage transaction-bound mutation pipeline for base entity records.
 */
@Slf4j
@Service
public class RecordMutationPipeline {

    private static final int MAX_RECORD_PAYLOAD_BYTES = 1024 * 1024; // 1MB

    private final EntityTypeRepository entityTypeRepository;
    private final EntityRecordRepository entityRecordRepository;
    private final AttributeDefinitionRepository attributeDefinitionRepository;
    private final RelationshipTypeRepository relationshipTypeRepository;
    private final EntityRelationshipRepository entityRelationshipRepository;
    private final RecordAuditLogRepository recordAuditLogRepository;
    private final SchemaValidationService schemaValidationService;
    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    @org.springframework.beans.factory.annotation.Autowired
    public RecordMutationPipeline(
            EntityTypeRepository entityTypeRepository,
            EntityRecordRepository entityRecordRepository,
            AttributeDefinitionRepository attributeDefinitionRepository,
            RelationshipTypeRepository relationshipTypeRepository,
            EntityRelationshipRepository entityRelationshipRepository,
            RecordAuditLogRepository recordAuditLogRepository,
            SchemaValidationService schemaValidationService,
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper
    ) {
        this.entityTypeRepository = entityTypeRepository;
        this.entityRecordRepository = entityRecordRepository;
        this.attributeDefinitionRepository = attributeDefinitionRepository;
        this.relationshipTypeRepository = relationshipTypeRepository;
        this.entityRelationshipRepository = entityRelationshipRepository;
        this.recordAuditLogRepository = recordAuditLogRepository;
        this.schemaValidationService = schemaValidationService;
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper != null ? objectMapper : new ObjectMapper();
    }

    public RecordMutationPipeline(
            EntityTypeRepository entityTypeRepository,
            EntityRecordRepository entityRecordRepository,
            AttributeDefinitionRepository attributeDefinitionRepository,
            RelationshipTypeRepository relationshipTypeRepository,
            EntityRelationshipRepository entityRelationshipRepository,
            RecordAuditLogRepository recordAuditLogRepository,
            SchemaValidationService schemaValidationService,
            JdbcTemplate jdbcTemplate
    ) {
        this(entityTypeRepository, entityRecordRepository, attributeDefinitionRepository,
             relationshipTypeRepository, entityRelationshipRepository, recordAuditLogRepository,
             schemaValidationService, jdbcTemplate, new ObjectMapper());
    }

    // Optional collaborators
    private EntityLifecycleService entityLifecycleService;
    private OutboxEventPublisher outboxEventPublisher;
    private org.springframework.context.ApplicationEventPublisher applicationEventPublisher;

    public void setEntityLifecycleService(EntityLifecycleService entityLifecycleService) {
        this.entityLifecycleService = entityLifecycleService;
    }

    public void setOutboxEventPublisher(OutboxEventPublisher outboxEventPublisher) {
        this.outboxEventPublisher = outboxEventPublisher;
    }

    public void setApplicationEventPublisher(org.springframework.context.ApplicationEventPublisher applicationEventPublisher) {
        this.applicationEventPublisher = applicationEventPublisher;
    }

    private void publishMutationEvent(Long entityTypeId, EntityRecord record, String action, String actor, Map<String, Object> delta) {
        if (applicationEventPublisher != null && record != null) {
            applicationEventPublisher.publishEvent(new EntityRecordMutatedEvent(
                    entityTypeId,
                    record.getId(),
                    record.getTenantId(),
                    action,
                    actor != null ? actor : "SYSTEM",
                    record.getVersion() != null ? record.getVersion() : 1L,
                    record.getAttributes(),
                    delta,
                    java.time.Instant.now()
            ));
        }
    }

    // =========================================================================
    // 1. CREATE RECORD PIPELINE
    // =========================================================================

    @Transactional
    public EntityRecordResponse executeCreate(Long entityTypeId, CreateRecordRequest request) {
        EntityType entityType = getActiveEntityType(entityTypeId);

        if (Boolean.TRUE.equals(entityType.getIsComposite())) {
            throw new UnsupportedOperationException("Composite entity types are strictly virtual and read-only. Direct mutations are forbidden.");
        }

        String effectiveTenantId = resolveTenantId(request.tenantId());
        validatePayloadSize(request.attributes());

        // Stage 2: Schema Defaults & Validation
        Map<String, Object> finalAttributes = applyAttributeDefaults(entityTypeId, request.attributes());
        if (entityLifecycleService != null) {
            entityLifecycleService.initializeStateOnCreation(entityType, finalAttributes);
        }

        // Stage 3: Referential Integrity & Strict Tenant Blindness
        validateReferentialIntegrity(entityTypeId, finalAttributes, effectiveTenantId);
        schemaValidationService.validatePayload(entityTypeId, finalAttributes);

        // Stage 4: Atomic Execution
        CreateRecordRequest finalRequest = new CreateRecordRequest(finalAttributes, effectiveTenantId);
        EntityRecord record = MetadataDtoMapper.toEntity(finalRequest, entityType);
        record.setTenantId(effectiveTenantId);
        record.setSchemaVersion(entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L);
        record.setVersion(1L);

        EntityRecord saved = entityRecordRepository.save(record);

        // Stage 6: Audit Logging & Outbox
        String actor = resolveCurrentActor();
        RecordAuditLog auditLog = RecordAuditLog.builder()
                .tenantId(effectiveTenantId)
                .recordId(saved.getId())
                .entityTypeId(entityTypeId)
                .operation("CREATE")
                .actor(actor)
                .version(saved.getVersion() != null ? saved.getVersion() : 1L)
                .oldAttributes(null)
                .newAttributes(saved.getAttributes())
                .delta(computeAttributeDelta(null, saved.getAttributes()))
                .createdAt(LocalDateTime.now())
                .build();
        if (recordAuditLogRepository != null) {
            recordAuditLogRepository.save(auditLog);
        }

        if (outboxEventPublisher != null) {
            outboxEventPublisher.publish("entity_record", String.valueOf(saved.getId()), "RECORD_CREATED", effectiveTenantId, saved.getAttributes());
        }
        publishMutationEvent(entityTypeId, saved, "CREATE", actor, auditLog.getDelta());

        return MetadataDtoMapper.toResponse(saved);
    }

    // =========================================================================
    // 2. UPDATE RECORD PIPELINE
    // =========================================================================

    @Transactional
    public EntityRecordResponse executeUpdate(Long entityTypeId, Long recordId, UpdateRecordRequest request, String ifMatchHeader) {
        EntityType entityType = getActiveEntityType(entityTypeId);

        if (Boolean.TRUE.equals(entityType.getIsComposite())) {
            throw new UnsupportedOperationException("Composite entity types are strictly virtual and read-only. Direct mutations are forbidden.");
        }

        EntityRecord record = getActiveRecord(entityTypeId, recordId);
        Map<String, Object> oldAttributes = record.getAttributes() != null ? new HashMap<>(record.getAttributes()) : new HashMap<>();

        // Stage 1: OCC & ETag Extraction
        Long expectedVersion = extractExpectedVersion(ifMatchHeader, request.version());

        // Stage 4 (OCC Check with 3-Way Auto-Merge):
        Map<String, Object> finalAttributes;
        if (expectedVersion != null && !expectedVersion.equals(record.getVersion())) {
            if (request.baseAttributes() != null) {
                finalAttributes = autoMergeAttributes(request.baseAttributes(), record.getAttributes(), request.attributes());
            } else {
                throw new MetadataConflictException("Optimistic lock conflict: EntityRecord version mismatch (expected: "
                        + record.getVersion() + ", actual: " + expectedVersion + ")");
            }
        } else {
            finalAttributes = request.attributes() != null ? new HashMap<>(request.attributes()) : new HashMap<>();
        }

        // Stage 2: Schema Defaults & Validation
        validatePayloadSize(finalAttributes);
        finalAttributes = applyAttributeDefaults(entityTypeId, finalAttributes);

        // Stage 3: Referential Integrity
        validateReferentialIntegrity(entityTypeId, finalAttributes, record.getTenantId());
        schemaValidationService.validatePayload(entityTypeId, finalAttributes);

        // Stage 4: Persist
        record.setAttributes(finalAttributes);
        record.setSchemaVersion(entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L);
        record.setVersion(record.getVersion() != null ? record.getVersion() + 1 : 1L);
        EntityRecord saved = entityRecordRepository.save(record);

        // Stage 6: Audit Logging & Outbox
        String actor = resolveCurrentActor();
        Map<String, Object> delta = computeAttributeDelta(oldAttributes, saved.getAttributes());
        RecordAuditLog auditLog = RecordAuditLog.builder()
                .tenantId(saved.getTenantId())
                .recordId(saved.getId())
                .entityTypeId(entityTypeId)
                .operation("UPDATE")
                .actor(actor)
                .version(saved.getVersion())
                .oldAttributes(oldAttributes)
                .newAttributes(saved.getAttributes())
                .delta(delta)
                .createdAt(LocalDateTime.now())
                .build();
        if (recordAuditLogRepository != null) {
            recordAuditLogRepository.save(auditLog);
        }

        if (outboxEventPublisher != null) {
            outboxEventPublisher.publish("entity_record", String.valueOf(saved.getId()), "RECORD_UPDATED", saved.getTenantId(), saved.getAttributes());
        }
        publishMutationEvent(entityTypeId, saved, "UPDATE", actor, delta);

        return MetadataDtoMapper.toResponse(saved);
    }

    // =========================================================================
    // 3. PATCH RECORD PIPELINE
    // =========================================================================

    @Transactional
    public EntityRecordResponse executePatch(Long entityTypeId, Long recordId, PatchRecordRequest request, String ifMatchHeader) {
        EntityType entityType = getActiveEntityType(entityTypeId);

        if (Boolean.TRUE.equals(entityType.getIsComposite())) {
            throw new UnsupportedOperationException("Composite entity types are strictly virtual and read-only. Direct mutations are forbidden.");
        }

        EntityRecord record = getActiveRecord(entityTypeId, recordId);
        Map<String, Object> currentAttributes = record.getAttributes() != null ? new HashMap<>(record.getAttributes()) : new HashMap<>();
        Map<String, Object> oldAttributes = new HashMap<>(currentAttributes);

        // Stage 1: OCC
        Long expectedVersion = extractExpectedVersion(ifMatchHeader, request.version());

        Map<String, Object> finalAttributes;
        if (expectedVersion != null && !expectedVersion.equals(record.getVersion())) {
            if (request.baseAttributes() != null) {
                Map<String, Object> incomingFull = new HashMap<>(request.baseAttributes());
                if (request.attributes() != null) {
                    incomingFull.putAll(request.attributes());
                }
                finalAttributes = autoMergeAttributes(request.baseAttributes(), currentAttributes, incomingFull);
            } else {
                throw new MetadataConflictException("Optimistic lock conflict: EntityRecord version mismatch (expected: "
                        + record.getVersion() + ", actual: " + expectedVersion + ")");
            }
        } else {
            finalAttributes = new HashMap<>(currentAttributes);
            if (request.attributes() != null) {
                finalAttributes.putAll(request.attributes());
            }
        }

        validatePayloadSize(finalAttributes);
        validateReferentialIntegrity(entityTypeId, finalAttributes, record.getTenantId());
        schemaValidationService.validatePayload(entityTypeId, finalAttributes);

        record.setAttributes(finalAttributes);
        record.setSchemaVersion(entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L);
        record.setVersion(record.getVersion() != null ? record.getVersion() + 1 : 1L);
        EntityRecord saved = entityRecordRepository.save(record);

        String actor = resolveCurrentActor();
        Map<String, Object> delta = computeAttributeDelta(oldAttributes, saved.getAttributes());
        RecordAuditLog auditLog = RecordAuditLog.builder()
                .tenantId(saved.getTenantId())
                .recordId(saved.getId())
                .entityTypeId(entityTypeId)
                .operation("UPDATE")
                .actor(actor)
                .version(saved.getVersion())
                .oldAttributes(oldAttributes)
                .newAttributes(saved.getAttributes())
                .delta(delta)
                .createdAt(LocalDateTime.now())
                .build();
        if (recordAuditLogRepository != null) {
            recordAuditLogRepository.save(auditLog);
        }

        if (outboxEventPublisher != null) {
            outboxEventPublisher.publish("entity_record", String.valueOf(saved.getId()), "RECORD_UPDATED", saved.getTenantId(), saved.getAttributes());
        }
        publishMutationEvent(entityTypeId, saved, "PATCH", actor, delta);

        return MetadataDtoMapper.toResponse(saved);
    }

    // =========================================================================
    // 4. DELETE RECORD PIPELINE (DECLARATIVE CASCADES)
    // =========================================================================

    @Transactional
    public void executeDelete(Long entityTypeId, Long recordId) {
        EntityType entityType = getActiveEntityType(entityTypeId);

        if (Boolean.TRUE.equals(entityType.getIsComposite())) {
            throw new UnsupportedOperationException("Composite entity types are strictly virtual and read-only. Direct mutations are forbidden.");
        }

        EntityRecord record = getActiveRecord(entityTypeId, recordId);
        String tenantId = record.getTenantId();

        // Stage 5: Declarative Delete Cascades
        executeDeleteCascades(entityTypeId, recordId, tenantId);

        // Soft delete the root record
        LocalDateTime now = LocalDateTime.now();
        record.setDeletedDate(now);
        record.setVersion(record.getVersion() != null ? record.getVersion() + 1 : 1L);
        entityRecordRepository.save(record);

        // Stage 6: Audit Logging & Outbox
        String actor = resolveCurrentActor();
        RecordAuditLog auditLog = RecordAuditLog.builder()
                .tenantId(tenantId)
                .recordId(record.getId())
                .entityTypeId(entityTypeId)
                .operation("SOFT_DELETE")
                .actor(actor)
                .version(record.getVersion())
                .oldAttributes(record.getAttributes())
                .newAttributes(null)
                .delta(null)
                .createdAt(now)
                .build();
        if (recordAuditLogRepository != null) {
            recordAuditLogRepository.save(auditLog);
        }

        if (outboxEventPublisher != null) {
            outboxEventPublisher.publish("entity_record", String.valueOf(record.getId()), "RECORD_DELETED", record.getTenantId(),
                    Map.of("id", recordId, "entityTypeId", entityTypeId));
        }
        publishMutationEvent(entityTypeId, record, "DELETE", actor, null);
    }

    private void executeDeleteCascades(Long entityTypeId, Long recordId, String tenantId) {
        // --- 1. Pattern B: Inbound JSONB attribute references ---
        List<AttributeDefinition> allAttributes = attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull(tenantId);
        for (AttributeDefinition attrDef : allAttributes) {
            if (Boolean.TRUE.equals(attrDef.getIsArchived())) continue;
            Map<String, Object> options = attrDef.getOptions() != null ? attrDef.getOptions() : Map.of();
            Object targetTypeIdObj = options.get("targetEntityTypeId");
            if (targetTypeIdObj == null) {
                targetTypeIdObj = options.get("target_entity_type_id");
            }
            if (targetTypeIdObj != null) {
                Long targetTypeId = targetTypeIdObj instanceof Number n ? n.longValue() : Long.parseLong(targetTypeIdObj.toString());
                if (targetTypeId.equals(entityTypeId)) {
                    String cascadePolicy = options.get("cascadePolicy") != null ? options.get("cascadePolicy").toString().toUpperCase() : "RESTRICT";
                    String attrName = attrDef.getSystemName();
                    Long childEntityTypeId = attrDef.getEntityType().getId();

                    // Check active referencing child records
                    if (jdbcTemplate != null) {
                        String countSql = "SELECT COUNT(*) FROM UNIPOST_ENTITIES WHERE tenant_id = ? AND entity_type_id = ? " +
                                "AND (attributes->>?)::text = ? AND \"deletedDate\" IS NULL";
                        Integer count = jdbcTemplate.queryForObject(countSql, Integer.class, tenantId, childEntityTypeId, attrName, String.valueOf(recordId));

                        if (count != null && count > 0) {
                            if ("RESTRICT".equalsIgnoreCase(cascadePolicy)) {
                                throw new MetadataConflictException(String.format(
                                        "Cannot delete record %d: %d referencing records exist under attribute '%s' of entity type '%s' (RESTRICT policy)",
                                        recordId, count, attrName, attrDef.getEntityType().getName()));
                            } else if ("CASCADE".equalsIgnoreCase(cascadePolicy)) {
                                // Bulk SQL soft-delete for referencing child records
                                String bulkDeleteSql = "UPDATE UNIPOST_ENTITIES SET \"deletedDate\" = NOW() " +
                                        "WHERE tenant_id = ? AND entity_type_id = ? AND (attributes->>?)::text = ? AND \"deletedDate\" IS NULL";
                                jdbcTemplate.update(bulkDeleteSql, tenantId, childEntityTypeId, attrName, String.valueOf(recordId));
                                log.info("Cascaded soft-delete on {} records of entity type {} referencing record {}", count, childEntityTypeId, recordId);
                            } else if ("SET_NULL".equalsIgnoreCase(cascadePolicy)) {
                                // Bulk SQL update clearing the foreign key attribute
                                String bulkSetNullSql = "UPDATE UNIPOST_ENTITIES SET attributes = attributes - ? " +
                                        "WHERE tenant_id = ? AND entity_type_id = ? AND (attributes->>?)::text = ? AND \"deletedDate\" IS NULL";
                                jdbcTemplate.update(bulkSetNullSql, attrName, tenantId, childEntityTypeId, attrName, String.valueOf(recordId));
                                log.info("Cleared reference '{}' on {} child records referencing record {}", attrName, count, recordId);
                            }
                        }
                    }
                }
            }
        }

        // --- 2. Pattern C: Graph Edges (UNIPOST_ENTITY_RELATIONSHIPS) ---
        List<EntityRelationship> sourceEdges = entityRelationshipRepository.findBySourceEntityIdAndDeletedDateIsNull(recordId);
        List<EntityRelationship> targetEdges = entityRelationshipRepository.findByTargetEntityIdAndDeletedDateIsNull(recordId);

        Set<EntityRelationship> edges = new HashSet<>(sourceEdges);
        edges.addAll(targetEdges);

        for (EntityRelationship edge : edges) {
            String policy = (edge.getRelationshipType() != null && edge.getRelationshipType().getCascadePolicy() != null)
                    ? edge.getRelationshipType().getCascadePolicy().toUpperCase()
                    : "RESTRICT";

            if ("RESTRICT".equals(policy)) {
                throw new MetadataConflictException(String.format(
                        "Cannot delete record %d: active relationship edge exists in '%s' (RESTRICT policy)",
                        recordId, edge.getRelationshipType().getSystemName()));
            } else if ("CASCADE".equals(policy)) {
                edge.setDeletedDate(LocalDateTime.now());
                entityRelationshipRepository.save(edge);
                // If this was the source, cascade soft-delete to target entity
                if (edge.getSourceEntity() != null && edge.getSourceEntity().getId().equals(recordId)) {
                    EntityRecord targetRec = edge.getTargetEntity();
                    if (targetRec != null && targetRec.getDeletedDate() == null) {
                        targetRec.setDeletedDate(LocalDateTime.now());
                        entityRecordRepository.save(targetRec);
                        log.info("Cascaded soft-delete to target entity record {} via edge {}", targetRec.getId(), edge.getId());
                    }
                }
            } else if ("SET_NULL".equals(policy) || "DETACH".equals(policy)) {
                edge.setDeletedDate(LocalDateTime.now());
                entityRelationshipRepository.save(edge);
                log.info("Detached relationship edge {} for record {}", edge.getId(), recordId);
            }
        }
    }

    // =========================================================================
    // 5. RESTORE RECORD PIPELINE (SOVEREIGN CUSTODY ONLY)
    // =========================================================================

    @Transactional(readOnly = true)
    public RestorePreviewResponse previewRestore(Long entityTypeId, Long recordId, Long auditLogId) {
        EntityType entityType = getActiveEntityType(entityTypeId);
        EntityRecord record = getActiveRecord(entityTypeId, recordId);
        RecordAuditLog auditLog = recordAuditLogRepository.findByTenantIdAndEntityTypeIdAndRecordIdAndId(
                record.getTenantId(), entityTypeId, recordId, auditLogId)
                .orElseThrow(() -> new MetadataNotFoundException("Audit log entry not found with id: " + auditLogId));

        Map<String, Object> historicalAttributes = auditLog.getNewAttributes() != null
                ? new HashMap<>(auditLog.getNewAttributes())
                : (auditLog.getOldAttributes() != null ? new HashMap<>(auditLog.getOldAttributes()) : new HashMap<>());

        Map<String, Object> currentAttributes = record.getAttributes() != null ? new HashMap<>(record.getAttributes()) : new HashMap<>();

        // Apply active schema defaults to historical attributes
        Map<String, Object> proposedAttributes = applyAttributeDefaults(entityTypeId, historicalAttributes);

        // Compute applied defaults
        Map<String, Object> appliedDefaults = new HashMap<>();
        for (Map.Entry<String, Object> e : proposedAttributes.entrySet()) {
            if (!historicalAttributes.containsKey(e.getKey())) {
                appliedDefaults.put(e.getKey(), e.getValue());
            }
        }

        // Compute removed fields
        List<String> removedFields = new ArrayList<>();
        for (String k : currentAttributes.keySet()) {
            if (!proposedAttributes.containsKey(k)) {
                removedFields.add(k);
            }
        }

        Map<String, Object> delta = computeAttributeDelta(currentAttributes, proposedAttributes);

        return new RestorePreviewResponse(
                recordId,
                auditLog.getVersion(),
                auditLogId,
                proposedAttributes,
                currentAttributes,
                delta,
                appliedDefaults,
                removedFields
        );
    }

    @Transactional
    public EntityRecordResponse executeRestore(Long entityTypeId, Long recordId, Long auditLogId) {
        EntityType entityType = getActiveEntityType(entityTypeId);

        if (Boolean.TRUE.equals(entityType.getIsComposite())) {
            throw new UnsupportedOperationException("Composite entity types are strictly virtual and read-only. Direct mutations are forbidden.");
        }

        EntityRecord record = getActiveRecord(entityTypeId, recordId);
        RecordAuditLog auditLog = recordAuditLogRepository.findByTenantIdAndEntityTypeIdAndRecordIdAndId(
                record.getTenantId(), entityTypeId, recordId, auditLogId)
                .orElseThrow(() -> new MetadataNotFoundException("Audit log entry not found with id: " + auditLogId));

        Map<String, Object> oldAttributes = record.getAttributes() != null ? new HashMap<>(record.getAttributes()) : new HashMap<>();
        Map<String, Object> historicalAttributes = auditLog.getNewAttributes() != null
                ? new HashMap<>(auditLog.getNewAttributes())
                : (auditLog.getOldAttributes() != null ? new HashMap<>(auditLog.getOldAttributes()) : new HashMap<>());

        // Stage 2: Apply active schema defaults & validate
        Map<String, Object> finalAttributes = applyAttributeDefaults(entityTypeId, historicalAttributes);
        validateReferentialIntegrity(entityTypeId, finalAttributes, record.getTenantId());
        schemaValidationService.validatePayload(entityTypeId, finalAttributes);

        // Stage 4: Monotonic version bump
        Long newVersion = (record.getVersion() != null ? record.getVersion() : 1L) + 1L;
        record.setAttributes(finalAttributes);
        record.setVersion(newVersion);
        record.setSchemaVersion(entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L);
        EntityRecord saved = entityRecordRepository.save(record);

        // Stage 6: Audit Log (Operation: RESTORE)
        String actor = resolveCurrentActor();
        Map<String, Object> delta = computeAttributeDelta(oldAttributes, finalAttributes);
        RecordAuditLog restoreAuditLog = RecordAuditLog.builder()
                .tenantId(saved.getTenantId())
                .recordId(saved.getId())
                .entityTypeId(entityTypeId)
                .operation("RESTORE")
                .actor(actor)
                .version(newVersion)
                .oldAttributes(oldAttributes)
                .newAttributes(finalAttributes)
                .delta(delta)
                .createdAt(LocalDateTime.now())
                .build();
        recordAuditLogRepository.save(restoreAuditLog);

        if (outboxEventPublisher != null) {
            outboxEventPublisher.publish("entity_record", String.valueOf(saved.getId()), "RECORD_RESTORED", saved.getTenantId(),
                    Map.of("id", saved.getId(), "entityTypeId", entityTypeId, "restoredFromVersion", auditLog.getVersion()));
        }
        publishMutationEvent(entityTypeId, saved, "RESTORE", actor, delta);

        return MetadataDtoMapper.toResponse(saved);
    }

    // =========================================================================
    // 6. AUDIT HISTORY QUERY
    // =========================================================================

    @Transactional(readOnly = true)
    public List<RecordAuditLogResponse> getRecordAuditLogs(Long entityTypeId, Long recordId) {
        String tenantId = TenantContextHolder.getTenantId();
        if (tenantId == null || tenantId.isBlank()) {
            tenantId = "SYSTEM";
        }
        List<RecordAuditLog> logs = recordAuditLogRepository.findByTenantIdAndEntityTypeIdAndRecordIdOrderByCreatedAtDesc(tenantId, entityTypeId, recordId);
        return logs.stream().map(l -> new RecordAuditLogResponse(
                l.getId(),
                l.getTenantId(),
                l.getRecordId(),
                l.getEntityTypeId(),
                l.getOperation(),
                l.getActor(),
                l.getVersion(),
                l.getOldAttributes(),
                l.getNewAttributes(),
                l.getDelta(),
                l.getCreatedAt()
        )).toList();
    }

    // =========================================================================
    // HELPER & VALIDATION METHODS
    // =========================================================================

    public Long extractExpectedVersion(String ifMatchHeader, Long bodyVersion) {
        if (ifMatchHeader != null && !ifMatchHeader.isBlank()) {
            String cleaned = ifMatchHeader.trim();
            if (cleaned.startsWith("W/")) {
                cleaned = cleaned.substring(2);
            }
            if (cleaned.startsWith("\"") && cleaned.endsWith("\"") && cleaned.length() >= 2) {
                cleaned = cleaned.substring(1, cleaned.length() - 1);
            }
            try {
                return Long.parseLong(cleaned);
            } catch (NumberFormatException ignored) {
                // fall through to bodyVersion
            }
        }
        return bodyVersion;
    }

    public Map<String, Object> computeAttributeDelta(Map<String, Object> oldAttrs, Map<String, Object> newAttrs) {
        if (oldAttrs == null && newAttrs == null) return null;
        Map<String, Object> safeOld = oldAttrs != null ? oldAttrs : Map.of();
        Map<String, Object> safeNew = newAttrs != null ? newAttrs : Map.of();

        Set<String> allKeys = new HashSet<>(safeOld.keySet());
        allKeys.addAll(safeNew.keySet());

        Map<String, Object> delta = new HashMap<>();
        for (String k : allKeys) {
            Object oldVal = safeOld.get(k);
            Object newVal = safeNew.get(k);
            if (!Objects.equals(oldVal, newVal)) {
                Map<String, Object> diffEntry = new HashMap<>();
                diffEntry.put("old", oldVal);
                diffEntry.put("new", newVal);
                delta.put(k, diffEntry);
            }
        }
        return delta.isEmpty() ? null : delta;
    }

    public Map<String, Object> autoMergeAttributes(
            Map<String, Object> base,
            Map<String, Object> current,
            Map<String, Object> incoming) {
        Map<String, Object> safeBase = base != null ? base : Map.of();
        Map<String, Object> safeCurrent = current != null ? current : Map.of();
        Map<String, Object> safeIncoming = incoming != null ? incoming : Map.of();

        Set<String> allKeys = new HashSet<>();
        allKeys.addAll(safeBase.keySet());
        allKeys.addAll(safeCurrent.keySet());
        allKeys.addAll(safeIncoming.keySet());

        Map<String, Object> merged = new HashMap<>();

        for (String key : allKeys) {
            Object baseVal = safeBase.get(key);
            Object curVal = safeCurrent.get(key);
            Object incVal = safeIncoming.get(key);

            boolean clientChanged = !Objects.equals(baseVal, incVal);
            boolean serverChanged = !Objects.equals(baseVal, curVal);

            if (clientChanged && serverChanged) {
                if (Objects.equals(curVal, incVal)) {
                    if (incVal != null) {
                        merged.put(key, incVal);
                    }
                } else {
                    throw new MetadataConflictException(
                            "Concurrent modification conflict on field '" + key + "': database value is '"
                                    + curVal + "', incoming value is '" + incVal + "'");
                }
            } else if (clientChanged) {
                if (incVal != null) {
                    merged.put(key, incVal);
                }
            } else {
                if (curVal != null) {
                    merged.put(key, curVal);
                }
            }
        }

        return merged;
    }

    public void validateReferentialIntegrity(Long entityTypeId, Map<String, Object> attributes, String tenantId) {
        if (attributes == null || attributes.isEmpty()) return;
        List<AttributeDefinition> definitions = attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(entityTypeId);
        for (AttributeDefinition def : definitions) {
            if (Boolean.TRUE.equals(def.getIsArchived())) continue;
            if ("relation_picker".equalsIgnoreCase(def.getUiComponent())) {
                Object val = attributes.get(def.getSystemName());
                if (val != null) {
                    Map<String, Object> options = def.getOptions() != null ? def.getOptions() : Map.of();
                    Object targetTypeIdObj = options.get("targetEntityTypeId");
                    if (targetTypeIdObj == null) {
                        targetTypeIdObj = options.get("target_entity_type_id");
                    }
                    if (targetTypeIdObj != null) {
                        Long targetTypeId = targetTypeIdObj instanceof Number n ? n.longValue() : Long.parseLong(targetTypeIdObj.toString());
                        Long targetRecordId = val instanceof Number n ? n.longValue() : Long.parseLong(val.toString());

                        // Enforce Strict Tenant Blindness: Must exist in the same tenant and not be deleted
                        Optional<EntityRecord> targetOpt = entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(targetTypeId, targetRecordId);
                        if (targetOpt.isEmpty() || !tenantId.equals(targetOpt.get().getTenantId())) {
                            throw new MetadataNotFoundException(String.format(
                                    "Referenced target entity record with id %d does not exist for entity type %d",
                                    targetRecordId, targetTypeId));
                        }
                    }
                }
            }
        }
    }

    public Map<String, Object> applyAttributeDefaults(Long entityTypeId, Map<String, Object> attributes) {
        Map<String, Object> finalAttributes = attributes != null ? new HashMap<>(attributes) : new HashMap<>();
        List<AttributeDefinition> definitions = attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(entityTypeId);

        for (AttributeDefinition def : definitions) {
            if (Boolean.TRUE.equals(def.getIsArchived())) continue;
            String key = def.getSystemName();
            if (!finalAttributes.containsKey(key) || finalAttributes.get(key) == null) {
                if (def.getDefaultValue() != null && !def.getDefaultValue().isBlank()) {
                    Object parsed = parseDefaultValue(def.getDataType(), def.getDefaultValue());
                    if (parsed != null) {
                        finalAttributes.put(key, parsed);
                    }
                }
            }
        }
        return finalAttributes;
    }

    private Object parseDefaultValue(String dataType, String defaultValue) {
        if (defaultValue == null) return null;
        try {
            return switch (dataType.toLowerCase()) {
                case "integer", "int" -> Long.parseLong(defaultValue.trim());
                case "long" -> Long.parseLong(defaultValue.trim());
                case "number", "float", "double" -> Double.parseDouble(defaultValue.trim());
                case "boolean", "bool" -> Boolean.parseBoolean(defaultValue.trim());
                default -> defaultValue;
            };
        } catch (Exception ignored) {
            return defaultValue;
        }
    }

    private void validatePayloadSize(Map<String, Object> attributes) {
        if (attributes == null || attributes.isEmpty()) {
            return;
        }
        if (attributes.size() > 500) {
            throw new IllegalArgumentException("Payload exceeds maximum permitted attribute count of 500");
        }
        try {
            byte[] bytes = objectMapper.writeValueAsBytes(attributes);
            if (bytes.length > MAX_RECORD_PAYLOAD_BYTES) {
                throw new MetadataConflictException(
                        "Payload size limit exceeded: Maximum 1MB allowed per record payload (received: " + bytes.length + " bytes)");
            }
        } catch (com.fasterxml.jackson.core.JsonProcessingException e) {
            log.warn("Failed to calculate payload byte size: {}", e.getMessage());
        }
    }

    private EntityType getActiveEntityType(Long entityTypeId) {
        return entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));
    }

    private EntityRecord getActiveRecord(Long entityTypeId, Long recordId) {
        return entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(entityTypeId, recordId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityRecord not found with id: " + recordId + " for entityTypeId: " + entityTypeId));
    }

    private String resolveTenantId(String requestedTenantId) {
        String activeTenantId = TenantContextHolder.getTenantId();
        String effectiveTenantId = (activeTenantId != null && !activeTenantId.isBlank()) ? activeTenantId : requestedTenantId;
        if (effectiveTenantId == null || effectiveTenantId.isBlank()) {
            throw new SecurityException("Tenant context required. Cannot mutate record without an active tenant boundary.");
        }
        return effectiveTenantId;
    }

    private String resolveCurrentActor() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getName() != null && !auth.getName().isBlank() && !"anonymousUser".equals(auth.getName())) {
            return auth.getName();
        }
        String tenant = TenantContextHolder.getTenantId();
        return (tenant != null && !tenant.isBlank()) ? tenant + "_USER" : "SYSTEM";
    }
}
