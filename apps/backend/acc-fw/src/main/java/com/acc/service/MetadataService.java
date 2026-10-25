package com.acc.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.core.io.Page;
import com.acc.core.io.PageRequest;
import com.acc.domain.metadata.AttributeDefinition;
import com.acc.domain.metadata.AttributeDefinitionUpdatedEvent;
import com.acc.domain.metadata.EntityRecord;
import com.acc.domain.metadata.EntityRelationship;
import com.acc.domain.metadata.EntityType;
import com.acc.domain.metadata.RelationshipType;
import com.acc.presentation.dto.metadata.*;
import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityRelationshipRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.repository.jpa.RelationshipTypeRepository;
import com.acc.service.exception.MetadataConflictException;
import com.acc.service.exception.MetadataNotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Slf4j
@Service
@Transactional(readOnly = true)
public class MetadataService {

    private final EntityTypeRepository entityTypeRepository;
    private final AttributeDefinitionRepository attributeDefinitionRepository;
    private final EntityRecordRepository entityRecordRepository;
    private final RelationshipTypeRepository relationshipTypeRepository;
    private final EntityRelationshipRepository entityRelationshipRepository;
    private final SchemaValidationService schemaValidationService;
    private final ApplicationEventPublisher eventPublisher;
    private final PageBuilder pageBuilder;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;
    private final CompositeSpecCompiler compositeSpecCompiler;
    private final DynamicIndexProvisioner dynamicIndexProvisioner;
    private com.acc.outbox.OutboxEventPublisher outboxEventPublisher;
    private com.acc.service.workflow.EntityLifecycleService entityLifecycleService;

    @org.springframework.beans.factory.annotation.Autowired
    public MetadataService(
            EntityTypeRepository entityTypeRepository,
            AttributeDefinitionRepository attributeDefinitionRepository,
            EntityRecordRepository entityRecordRepository,
            RelationshipTypeRepository relationshipTypeRepository,
            EntityRelationshipRepository entityRelationshipRepository,
            SchemaValidationService schemaValidationService,
            ApplicationEventPublisher eventPublisher,
            PageBuilder pageBuilder,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper,
            CompositeSpecCompiler compositeSpecCompiler,
            DynamicIndexProvisioner dynamicIndexProvisioner
    ) {
        this.entityTypeRepository = entityTypeRepository;
        this.attributeDefinitionRepository = attributeDefinitionRepository;
        this.entityRecordRepository = entityRecordRepository;
        this.relationshipTypeRepository = relationshipTypeRepository;
        this.entityRelationshipRepository = entityRelationshipRepository;
        this.schemaValidationService = schemaValidationService;
        this.eventPublisher = eventPublisher;
        this.pageBuilder = pageBuilder;
        this.objectMapper = objectMapper;
        this.compositeSpecCompiler = compositeSpecCompiler;
        this.dynamicIndexProvisioner = dynamicIndexProvisioner;
    }

    public MetadataService(
            EntityTypeRepository entityTypeRepository,
            AttributeDefinitionRepository attributeDefinitionRepository,
            EntityRecordRepository entityRecordRepository,
            RelationshipTypeRepository relationshipTypeRepository,
            EntityRelationshipRepository entityRelationshipRepository,
            SchemaValidationService schemaValidationService,
            ApplicationEventPublisher eventPublisher,
            PageBuilder pageBuilder,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper
    ) {
        this(
            entityTypeRepository,
            attributeDefinitionRepository,
            entityRecordRepository,
            relationshipTypeRepository,
            entityRelationshipRepository,
            schemaValidationService,
            eventPublisher,
            pageBuilder,
            objectMapper,
            new CompositeSpecCompiler(objectMapper != null ? objectMapper : new com.fasterxml.jackson.databind.ObjectMapper()),
            new DynamicIndexProvisioner(null)
        );
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setOutboxEventPublisher(com.acc.outbox.OutboxEventPublisher outboxEventPublisher) {
        this.outboxEventPublisher = outboxEventPublisher;
        if (this.recordMutationPipeline != null) {
            this.recordMutationPipeline.setOutboxEventPublisher(outboxEventPublisher);
        }
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setEntityLifecycleService(com.acc.service.workflow.EntityLifecycleService entityLifecycleService) {
        this.entityLifecycleService = entityLifecycleService;
        if (this.recordMutationPipeline != null) {
            this.recordMutationPipeline.setEntityLifecycleService(entityLifecycleService);
        }
    }

    private RecordMutationPipeline recordMutationPipeline;

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setRecordMutationPipeline(RecordMutationPipeline recordMutationPipeline) {
        this.recordMutationPipeline = recordMutationPipeline;
        if (this.recordMutationPipeline != null) {
            if (this.outboxEventPublisher != null) {
                this.recordMutationPipeline.setOutboxEventPublisher(this.outboxEventPublisher);
            }
            if (this.entityLifecycleService != null) {
                this.recordMutationPipeline.setEntityLifecycleService(this.entityLifecycleService);
            }
            this.recordMutationPipeline.setApplicationEventPublisher(this.eventPublisher);
        }
    }

    private RecordMutationPipeline getOrCreatePipeline() {
        if (this.recordMutationPipeline == null) {
            this.recordMutationPipeline = new RecordMutationPipeline(
                    entityTypeRepository,
                    entityRecordRepository,
                    attributeDefinitionRepository,
                    relationshipTypeRepository,
                    entityRelationshipRepository,
                    null,
                    schemaValidationService,
                    null,
                    this.objectMapper != null ? this.objectMapper : new ObjectMapper()
            );
            if (this.outboxEventPublisher != null) {
                this.recordMutationPipeline.setOutboxEventPublisher(this.outboxEventPublisher);
            }
            if (this.entityLifecycleService != null) {
                this.recordMutationPipeline.setEntityLifecycleService(this.entityLifecycleService);
            }
            this.recordMutationPipeline.setApplicationEventPublisher(this.eventPublisher);
        }
        return this.recordMutationPipeline;
    }

    private static final long MAX_RECORD_PAYLOAD_BYTES = 1024 * 1024; // 1 MB limit
    private static final Pattern DANGEROUS_REGEX_PATTERN = Pattern.compile("(\\(.*[+*]\\)[+*]|\\([a-zA-Z0-9_\\[\\]|-]+[+*]\\)[+*])");

    private org.springframework.data.domain.PageRequest toSpringPageRequest(PageRequest request) {
        int page = (request != null && request.getNumber() != null && request.getNumber() > 0) ? request.getNumber() - 1 : 0;
        int size = (request != null && request.getSize() > 0) ? request.getSize() : 10;
        return org.springframework.data.domain.PageRequest.of(page, size);
    }

    private void incrementSchemaVersion(EntityType entityType) {
        long prevVersion = entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L;
        long nextVersion = prevVersion + 1L;
        entityType.setSchemaVersion(nextVersion);
        entityTypeRepository.save(entityType);
        log.info("Schema evolved for entityType '{}' (id: {}): version {} -> {}", 
                entityType.getSystemName(), entityType.getId(), prevVersion, nextVersion);
    }

    // ==========================================
    // 1. Entity Type Lifecycle
    // ==========================================

    public Page<EntityTypeResponse> getEntityTypes(PageRequest pageRequest) {
        org.springframework.data.domain.Page<EntityType> springPage = entityTypeRepository.findAllByDeletedDateIsNull(toSpringPageRequest(pageRequest));
        return pageBuilder.build(
                pageRequest,
                springPage::getTotalElements,
                () -> springPage.getContent().stream().map(MetadataDtoMapper::toResponse).collect(Collectors.toList())
        );
    }

    public EntityTypeResponse getEntityType(Long id) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(id)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + id));
        return MetadataDtoMapper.toResponse(entityType);
    }

    public CompiledSchemaResponse getCompiledSchema(Long id) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(id)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + id));
        com.fasterxml.jackson.databind.JsonNode schemaNode = schemaValidationService.compileSchemaNode(id);
        return new CompiledSchemaResponse(id, entityType.getSchemaVersion(), schemaNode);
    }

    @Transactional
    public EntityTypeResponse createEntityType(CreateEntityTypeRequest request) {
        // Tier 2 Resource Quotas: Cap maximum entity types per tenant to 50
        long currentEntityCount = entityTypeRepository.countByDeletedDateIsNull();
        if (currentEntityCount >= 50) {
            throw new MetadataConflictException("Tenant entity quota exceeded: Maximum of 50 EntityTypes allowed per workspace");
        }

        if (entityTypeRepository.existsBySystemNameAndDeletedDateIsNull(request.systemName().trim())) {
            throw new MetadataConflictException("EntityType with systemName '" + request.systemName() + "' already exists");
        }
        EntityType entityType = MetadataDtoMapper.toEntity(request);
        if (Boolean.TRUE.equals(request.isComposite())) {
            entityType.setIsComposite(true);
            if (request.compositeSpec() != null) {
                compositeSpecCompiler.validateHierarchy(request.compositeSpec());
                entityType.setCompositeSpec(request.compositeSpec());
            }
        }
        EntityType saved = entityTypeRepository.save(entityType);
        if (Boolean.TRUE.equals(saved.getIsComposite()) && saved.getCompositeSpec() != null) {
            dynamicIndexProvisioner.provisionIndexesAsync(saved.getCompositeSpec());
        }
        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public EntityTypeResponse updateEntityType(Long id, UpdateEntityTypeRequest request) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(id)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + id));

        // Optimistic locking check
        if (request.version() != null && !request.version().equals(entityType.getVersion())) {
            throw new MetadataConflictException("Optimistic lock conflict: EntityType version mismatch (expected: " 
                    + entityType.getVersion() + ", actual: " + request.version() + ")");
        }

        entityType.setName(request.name().trim());
        entityType.setDescription(request.description() != null ? request.description().trim() : null);
        if (request.isComposite() != null) {
            entityType.setIsComposite(request.isComposite());
        }
        if (request.compositeSpec() != null) {
            compositeSpecCompiler.validateHierarchy(request.compositeSpec());
            entityType.setCompositeSpec(request.compositeSpec());
            dynamicIndexProvisioner.provisionIndexesAsync(request.compositeSpec());
        }
        long nextVersion = (entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L) + 1L;
        entityType.setSchemaVersion(nextVersion);

        EntityType saved = entityTypeRepository.save(entityType);
        eventPublisher.publishEvent(new AttributeDefinitionUpdatedEvent(this, id));
        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public void deleteEntityType(Long id) {
        validateNoCompositeDependencyOnEntityType(id);

        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(id)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + id));

        LocalDateTime now = LocalDateTime.now();
        entityType.setDeletedDate(now);
        entityTypeRepository.save(entityType);

        // Cascading soft-delete to attributes
        List<AttributeDefinition> attributes = attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(id);
        for (AttributeDefinition attr : attributes) {
            attr.setDeletedDate(now);
            attributeDefinitionRepository.save(attr);
        }

        // Cascading soft-delete to records
        List<EntityRecord> records = entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(id);
        for (EntityRecord record : records) {
            record.setDeletedDate(now);
            entityRecordRepository.save(record);
        }

        eventPublisher.publishEvent(new AttributeDefinitionUpdatedEvent(this, id));
    }

    // ==========================================
    // 2. Attribute Definition Lifecycle
    // ==========================================

    public Page<AttributeDefinitionResponse> getAttributeDefinitions(Long entityTypeId, PageRequest pageRequest) {
        if (!entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId).isPresent()) {
            throw new MetadataNotFoundException("EntityType not found with id: " + entityTypeId);
        }
        org.springframework.data.domain.Page<AttributeDefinition> springPage = 
                attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(entityTypeId, toSpringPageRequest(pageRequest));
        return pageBuilder.build(
                pageRequest,
                springPage::getTotalElements,
                () -> springPage.getContent().stream().map(MetadataDtoMapper::toResponse).collect(Collectors.toList())
        );
    }

    public AttributeDefinitionResponse getAttributeDefinition(Long entityTypeId, Long attributeId) {
        if (!entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId).isPresent()) {
            throw new MetadataNotFoundException("EntityType not found with id: " + entityTypeId);
        }
        AttributeDefinition attr = attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(entityTypeId, attributeId)
                .orElseThrow(() -> new MetadataNotFoundException("AttributeDefinition not found with id: " + attributeId + " for entityTypeId: " + entityTypeId));
        return MetadataDtoMapper.toResponse(attr);
    }

    @Transactional
    public AttributeDefinitionResponse createAttributeDefinition(Long entityTypeId, CreateAttributeRequest request) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        String reqSysName = request.systemName().trim();
        List<AttributeDefinition> existingAttrs = attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(entityTypeId);

        // Tier 2 Resource Quotas: Cap maximum attributes per entity type to 100
        if (existingAttrs.size() >= 100) {
            throw new MetadataConflictException("Entity attribute quota exceeded: Maximum of 100 attributes allowed per EntityType");
        }

        // Tier 2 ReDoS Mitigation: Pre-flight static regex inspection for dangerous nested quantifiers
        if (request.options() != null && request.options().containsKey("pattern")) {
            Object patternObj = request.options().get("pattern");
            if (patternObj != null) {
                String patternStr = patternObj.toString();
                if (isDangerousRegex(patternStr)) {
                    throw new MetadataConflictException("Regular expression pattern rejected: Catastrophic nested quantifier detected (potential ReDoS vulnerability)");
                }
            }
        }
        
        // Check collision against any active attribute (including SYSTEM base attributes)
        boolean nameExists = existingAttrs.stream()
                .anyMatch(a -> a.getSystemName() != null && a.getSystemName().equalsIgnoreCase(reqSysName));
        if (nameExists) {
            throw new MetadataConflictException("Attribute with systemName '" + reqSysName + "' already exists for EntityType " + entityTypeId);
        }

        AttributeDefinition attributeDefinition = MetadataDtoMapper.toEntity(request, entityType);
        String activeTenantId = com.acc.fw.tenancy.TenantContextHolder.getTenantId();
        if (activeTenantId != null && !activeTenantId.isBlank()) {
            attributeDefinition.setTenantId(activeTenantId);
        }

        int nextOrder = existingAttrs.stream()
                .mapToInt(a -> a.getDisplayOrder() != null ? a.getDisplayOrder() : 0)
                .max()
                .orElse(-1) + 1;
        attributeDefinition.setDisplayOrder(nextOrder);

        AttributeDefinition saved = attributeDefinitionRepository.save(attributeDefinition);

        incrementSchemaVersion(entityType);
        eventPublisher.publishEvent(new AttributeDefinitionUpdatedEvent(this, entityTypeId, activeTenantId));
        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public AttributeDefinitionResponse updateAttributeDefinition(Long entityTypeId, Long attributeId, UpdateAttributeRequest request) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        AttributeDefinition attr = attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(entityTypeId, attributeId)
                .orElseThrow(() -> new MetadataNotFoundException("AttributeDefinition not found with id: " + attributeId + " for entityTypeId: " + entityTypeId));

        // System Field Immutability Guard: Tenants cannot mutate system attributes, but SYSTEM custodian can
        String callerTenant = com.acc.fw.tenancy.TenantContextHolder.getTenantId();
        boolean isSovereign = "SYSTEM".equalsIgnoreCase(callerTenant) || com.acc.fw.tenancy.TenantContextHolder.isSovereignActor();
        if ("SYSTEM".equalsIgnoreCase(attr.getTenantId()) && !isSovereign) {
            throw new MetadataConflictException("System attributes (tenant_id = 'SYSTEM') are immutable and cannot be modified by tenant admins");
        }

        // Optimistic locking check
        if (request.version() != null && !request.version().equals(attr.getVersion())) {
            throw new MetadataConflictException("Optimistic lock conflict: AttributeDefinition version mismatch (expected: " 
                    + attr.getVersion() + ", actual: " + request.version() + ")");
        }

        // Validate compatibility if uiComponent is updated
        if (request.uiComponent() != null && !request.uiComponent().equalsIgnoreCase(attr.getUiComponent())) {
            validateUiComponentCompatibility(attr.getDataType(), request.uiComponent());
            attr.setUiComponent(request.uiComponent().trim().toLowerCase());
        }

        attr.setName(request.name().trim());
        if (request.isRequired() != null) attr.setIsRequired(request.isRequired());
        if (request.isArchived() != null) attr.setIsArchived(request.isArchived());
        if (request.displayOrder() != null) attr.setDisplayOrder(request.displayOrder());
        if (request.options() != null) attr.setOptions(request.options());
        if (request.defaultValue() != null) attr.setDefaultValue(request.defaultValue());

        AttributeDefinition saved = attributeDefinitionRepository.save(attr);

        incrementSchemaVersion(entityType);
        String activeTenantId = com.acc.fw.tenancy.TenantContextHolder.getTenantId();
        eventPublisher.publishEvent(new AttributeDefinitionUpdatedEvent(this, entityTypeId, activeTenantId));
        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public void deleteAttributeDefinition(Long entityTypeId, Long attributeId, boolean force) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        AttributeDefinition attr = attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(entityTypeId, attributeId)
                .orElseThrow(() -> new MetadataNotFoundException("AttributeDefinition not found with id: " + attributeId + " for entityTypeId: " + entityTypeId));

        // System Field Immutability Guard: Tenants cannot delete system attributes, but SYSTEM custodian can
        String deleteCallerTenant = com.acc.fw.tenancy.TenantContextHolder.getTenantId();
        boolean isDeleteSovereign = "SYSTEM".equalsIgnoreCase(deleteCallerTenant) || com.acc.fw.tenancy.TenantContextHolder.isSovereignActor();
        if ("SYSTEM".equalsIgnoreCase(attr.getTenantId()) && !isDeleteSovereign) {
            throw new MetadataConflictException("System attributes (tenant_id = 'SYSTEM') are immutable and cannot be deleted by tenant admins");
        }

        // Composite Dependency Guard: Cannot delete attribute referenced in composite specs
        validateNoCompositeDependencyOnAttribute(entityTypeId, attr.getSystemName());

        // Delete guard: check if any record contains this attribute key
        if (!force) {
            List<EntityRecord> records = entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(entityTypeId);
            boolean keyInUse = records.stream().anyMatch(r -> r.getAttributes() != null && r.getAttributes().containsKey(attr.getSystemName()));
            if (keyInUse) {
                throw new MetadataConflictException("Cannot delete attribute '" + attr.getSystemName() 
                        + "' because existing records contain values for it. Archive the attribute or specify force=true to proceed.");
            }
        }

        attr.setDeletedDate(LocalDateTime.now());
        attributeDefinitionRepository.save(attr);

        incrementSchemaVersion(entityType);
        String activeTenantId = com.acc.fw.tenancy.TenantContextHolder.getTenantId();
        eventPublisher.publishEvent(new AttributeDefinitionUpdatedEvent(this, entityTypeId, activeTenantId));
    }

    @Transactional
    public AttributeDefinitionResponse archiveAttributeDefinition(Long entityTypeId, Long attributeId) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        AttributeDefinition attr = attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(entityTypeId, attributeId)
                .orElseThrow(() -> new MetadataNotFoundException("AttributeDefinition not found with id: " + attributeId + " for entityTypeId: " + entityTypeId));

        String archiveCallerTenant = com.acc.fw.tenancy.TenantContextHolder.getTenantId();
        boolean isArchiveSovereign = "SYSTEM".equalsIgnoreCase(archiveCallerTenant) || com.acc.fw.tenancy.TenantContextHolder.isSovereignActor();
        if ("SYSTEM".equalsIgnoreCase(attr.getTenantId()) && !isArchiveSovereign) {
            throw new MetadataConflictException("System attributes (tenant_id = 'SYSTEM') are immutable and cannot be archived by tenant admins");
        }

        // Composite Dependency Guard: Cannot archive attribute referenced in composite specs
        validateNoCompositeDependencyOnAttribute(entityTypeId, attr.getSystemName());

        attr.setIsArchived(true);
        AttributeDefinition saved = attributeDefinitionRepository.save(attr);

        incrementSchemaVersion(entityType);
        String activeTenantId = com.acc.fw.tenancy.TenantContextHolder.getTenantId();
        eventPublisher.publishEvent(new AttributeDefinitionUpdatedEvent(this, entityTypeId, activeTenantId));
        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public AttributeDefinitionResponse unarchiveAttributeDefinition(Long entityTypeId, Long attributeId) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        AttributeDefinition attr = attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(entityTypeId, attributeId)
                .orElseThrow(() -> new MetadataNotFoundException("AttributeDefinition not found with id: " + attributeId + " for entityTypeId: " + entityTypeId));

        attr.setIsArchived(false);
        AttributeDefinition saved = attributeDefinitionRepository.save(attr);

        incrementSchemaVersion(entityType);
        String activeTenantId = com.acc.fw.tenancy.TenantContextHolder.getTenantId();
        eventPublisher.publishEvent(new AttributeDefinitionUpdatedEvent(this, entityTypeId, activeTenantId));
        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public List<AttributeDefinitionResponse> reorderAttributes(Long entityTypeId, ReorderAttributesRequest request) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        List<Long> orderedIds = request.attributeIds();
        List<AttributeDefinition> attributes = attributeDefinitionRepository.findAllByIdInAndEntityTypeIdAndDeletedDateIsNull(orderedIds, entityTypeId);
        Map<Long, AttributeDefinition> attrMap = attributes.stream().collect(Collectors.toMap(AttributeDefinition::getId, a -> a));

        List<AttributeDefinitionResponse> result = new ArrayList<>();
        for (int i = 0; i < orderedIds.size(); i++) {
            Long id = orderedIds.get(i);
            AttributeDefinition attr = attrMap.get(id);
            if (attr != null) {
                attr.setDisplayOrder(i);
                attributeDefinitionRepository.save(attr);
                result.add(MetadataDtoMapper.toResponse(attr));
            }
        }

        incrementSchemaVersion(entityType);
        String activeTenantId = com.acc.fw.tenancy.TenantContextHolder.getTenantId();
        eventPublisher.publishEvent(new AttributeDefinitionUpdatedEvent(this, entityTypeId, activeTenantId));
        return result;
    }

    private void validateUiComponentCompatibility(String dataType, String newUiComponent) {
        if (newUiComponent == null || dataType == null) return;
        String comp = newUiComponent.toLowerCase();
        String dt = dataType.toLowerCase();
        boolean valid = switch (dt) {
            case "string" -> comp.equals("text") || comp.equals("textarea") || comp.equals("select") || comp.equals("datepicker") || comp.equals("relation_picker");
            case "number", "integer" -> comp.equals("number") || comp.equals("text");
            case "boolean" -> comp.equals("switch");
            case "date" -> comp.equals("datepicker") || comp.equals("text");
            case "json" -> comp.equals("json_editor");
            case "array" -> comp.equals("multiselect") || comp.equals("json_editor");
            case "relation" -> comp.equals("relation_picker") || comp.equals("text");
            default -> true;
        };
        if (!valid) {
            throw new MetadataConflictException("uiComponent '" + newUiComponent + "' is not compatible with dataType '" + dataType + "'");
        }
    }

    // ==========================================
    // 3. Entity Record Lifecycle
    // ==========================================

    private Map<String, Object> applyAttributeDefaults(Long entityTypeId, Map<String, Object> attributes) {
        Map<String, Object> result = new HashMap<>();
        List<AttributeDefinition> definitions = attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(entityTypeId);
        
        for (AttributeDefinition def : definitions) {
            if (Boolean.TRUE.equals(def.getIsArchived())) continue;
            if (def.getDefaultValue() != null && !def.getDefaultValue().isBlank()) {
                String type = def.getDataType() != null ? def.getDataType().trim().toLowerCase() : "string";
                try {
                    switch (type) {
                        case "boolean" -> result.put(def.getSystemName(), Boolean.parseBoolean(def.getDefaultValue()));
                        case "integer" -> result.put(def.getSystemName(), Long.parseLong(def.getDefaultValue().trim()));
                        case "number" -> result.put(def.getSystemName(), Double.parseDouble(def.getDefaultValue().trim()));
                        default -> result.put(def.getSystemName(), def.getDefaultValue());
                    }
                } catch (Exception ignored) {
                    result.put(def.getSystemName(), def.getDefaultValue());
                }
            }
        }
        
        if (attributes != null) {
            result.putAll(attributes);
        }
        return result;
    }

    public Page<EntityRecordResponse> getEntityRecords(
            Long entityTypeId,
            PageRequest pageRequest,
            Map<String, Map<String, String>> filterParams,
            String sortProperty,
            String sortDirection,
            String tenantId) {
        if (!entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId).isPresent()) {
            throw new MetadataNotFoundException("EntityType not found with id: " + entityTypeId);
        }

        // If tenantId was not explicitly provided, default to the authenticated thread tenant
        String activeTenantId = (tenantId != null && !tenantId.isBlank())
                ? tenantId
                : com.acc.fw.tenancy.TenantContextHolder.getTenantId();

        List<AttributeDefinition> definitions = attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(entityTypeId);
        Map<String, AttributeDefinition> activeAttributes = definitions.stream()
                .filter(d -> !Boolean.TRUE.equals(d.getIsArchived()))
                .collect(Collectors.toMap(AttributeDefinition::getSystemName, d -> d, (a, b) -> a));

        org.springframework.data.domain.Pageable pageable = toSpringPageRequest(pageRequest);
        if (sortProperty != null && !sortProperty.isBlank()) {
            org.springframework.data.domain.Sort.Direction direction = "desc".equalsIgnoreCase(sortDirection) 
                    ? org.springframework.data.domain.Sort.Direction.DESC 
                    : org.springframework.data.domain.Sort.Direction.ASC;

            // Whitelist sort fields
            if ("id".equalsIgnoreCase(sortProperty) || "createdDate".equalsIgnoreCase(sortProperty) || "lastUpdatedDate".equalsIgnoreCase(sortProperty)) {
                pageable = org.springframework.data.domain.PageRequest.of(pageable.getPageNumber(), pageable.getPageSize(), org.springframework.data.domain.Sort.by(direction, sortProperty));
            }
        }

        org.springframework.data.jpa.domain.Specification<EntityRecord> spec = EntityRecordSpecifications.withFilters(
                entityTypeId,
                activeTenantId,
                filterParams,
                activeAttributes
        );

        org.springframework.data.domain.Page<EntityRecord> springPage = entityRecordRepository.findAll(spec, pageable);
        return pageBuilder.build(
                pageRequest,
                springPage::getTotalElements,
                () -> springPage.getContent().stream().map(MetadataDtoMapper::toResponse).collect(Collectors.toList())
        );
    }

    public Page<EntityRecordResponse> getEntityRecords(Long entityTypeId, PageRequest pageRequest) {
        return getEntityRecords(entityTypeId, pageRequest, null, null, null, null);
    }

    public SeekPageResponse<EntityRecordResponse> seekEntityRecords(Long entityTypeId, String cursor, int limit, String tenantId) {
        if (!entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId).isPresent()) {
            throw new MetadataNotFoundException("EntityType not found with id: " + entityTypeId);
        }

        String activeTenantId = (tenantId != null && !tenantId.isBlank())
                ? tenantId
                : com.acc.fw.tenancy.TenantContextHolder.getTenantId();

        Long afterId = null;
        if (cursor != null && !cursor.isBlank()) {
            try {
                String decoded = new String(Base64.getDecoder().decode(cursor.trim()), java.nio.charset.StandardCharsets.UTF_8);
                if (decoded.contains(":")) {
                    String[] parts = decoded.split(":");
                    afterId = Long.parseLong(parts[parts.length - 1]);
                } else {
                    afterId = Long.parseLong(decoded);
                }
            } catch (Exception e) {
                log.warn("Malformed keyset cursor: {}, ignoring and seeking from start", cursor);
            }
        }

        int pageSize = limit > 0 ? Math.min(limit, 200) : 50;
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, pageSize + 1);
        List<EntityRecord> records = entityRecordRepository.seekRecords(entityTypeId, activeTenantId, afterId, pageable);

        boolean hasMore = records.size() > pageSize;
        List<EntityRecord> pageRecords = hasMore ? records.subList(0, pageSize) : records;

        String nextCursor = null;
        if (hasMore && !pageRecords.isEmpty()) {
            Long lastId = pageRecords.get(pageRecords.size() - 1).getId();
            nextCursor = Base64.getEncoder().encodeToString(String.valueOf(lastId).getBytes(java.nio.charset.StandardCharsets.UTF_8));
        }

        List<EntityRecordResponse> responses = pageRecords.stream()
                .map(MetadataDtoMapper::toResponse)
                .collect(Collectors.toList());

        return new SeekPageResponse<>(responses, nextCursor, hasMore, pageSize);
    }

    public EntityRecordResponse getEntityRecord(Long entityTypeId, Long recordId) {
        if (!entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId).isPresent()) {
            throw new MetadataNotFoundException("EntityType not found with id: " + entityTypeId);
        }
        EntityRecord record = entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(entityTypeId, recordId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityRecord not found with id: " + recordId + " for entityTypeId: " + entityTypeId));
        return MetadataDtoMapper.toResponse(record);
    }

    public ValidateRecordResponse validateEntityRecordDryRun(Long entityTypeId, CreateRecordRequest request) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        Long schemaVersion = entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L;
        List<ValidateRecordResponse.ValidationErrorDetail> errorDetails = new ArrayList<>();

        Map<String, Object> finalAttributes = applyAttributeDefaults(entityTypeId, request.attributes());

        // 1. Dry-run validate RelationPicker references
        if (finalAttributes != null && !finalAttributes.isEmpty()) {
            List<AttributeDefinition> definitions = attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(entityTypeId);
            for (AttributeDefinition def : definitions) {
                if (Boolean.TRUE.equals(def.getIsArchived())) continue;
                if ("relation_picker".equalsIgnoreCase(def.getUiComponent())) {
                    Object val = finalAttributes.get(def.getSystemName());
                    if (val != null) {
                        Map<String, Object> options = def.getOptions() != null ? def.getOptions() : Map.of();
                        Object targetTypeIdObj = options.get("targetEntityTypeId");
                        if (targetTypeIdObj != null) {
                            try {
                                Long targetTypeId = targetTypeIdObj instanceof Number n ? n.longValue() : Long.parseLong(targetTypeIdObj.toString());
                                Long targetRecordId = val instanceof Number n ? n.longValue() : Long.parseLong(val.toString());
                                boolean exists = entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(targetTypeId, targetRecordId).isPresent();
                                if (!exists) {
                                    errorDetails.add(new ValidateRecordResponse.ValidationErrorDetail(
                                            def.getSystemName(),
                                            "Referenced target record #" + targetRecordId + " does not exist for entity type " + targetTypeId,
                                            "REFERENCED_RECORD_NOT_FOUND"
                                    ));
                                }
                            } catch (Exception e) {
                                errorDetails.add(new ValidateRecordResponse.ValidationErrorDetail(
                                        def.getSystemName(),
                                        "Invalid record reference: " + val,
                                        "INVALID_REFERENCE"
                                ));
                            }
                        }
                    }
                }
            }
        }

        // 2. Dry-run validate against Draft-07 JSON Schema rules
        List<com.acc.core.io.Error> schemaErrors = schemaValidationService.validatePayloadDryRun(entityTypeId, finalAttributes);
        for (com.acc.core.io.Error<?> err : schemaErrors) {
            String detailStr = err.getDetail() != null ? String.valueOf(err.getDetail()) : null;
            errorDetails.add(new ValidateRecordResponse.ValidationErrorDetail(
                    detailStr,
                    err.getMessage(),
                    err.getCode() != null ? err.getCode() : "VALIDATION_ERROR"
            ));
        }

        if (errorDetails.isEmpty()) {
            return ValidateRecordResponse.success(entityTypeId, schemaVersion);
        } else {
            return ValidateRecordResponse.failure(entityTypeId, schemaVersion, errorDetails);
        }
    }

    public SchemaDriftAnalysisResponse analyzeSchemaDrift(Long entityTypeId) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        Long currentVersion = entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L;
        List<EntityRecord> allRecords = entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(entityTypeId);
        long total = allRecords.size();
        long outdated = allRecords.stream()
                .filter(r -> r.getSchemaVersion() == null || r.getSchemaVersion() < currentVersion)
                .count();

        return new SchemaDriftAnalysisResponse(
                entityTypeId,
                currentVersion,
                total,
                outdated,
                total - outdated
        );
    }

    @Transactional
    public SchemaBackfillExecutionResponse executeSchemaBackfill(Long entityTypeId, int batchSize) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        Long targetVersion = entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L;
        int effectiveBatchSize = batchSize > 0 ? Math.min(batchSize, 500) : 100;

        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(0, effectiveBatchSize);
        org.springframework.data.domain.Page<EntityRecord> outdatedPage = entityRecordRepository
                .findByEntityTypeIdAndSchemaVersionLessThanAndDeletedDateIsNull(entityTypeId, targetVersion, pageable);

        List<EntityRecord> recordsToMigrate = outdatedPage.getContent();
        int processed = 0;
        int migrated = 0;
        int failed = 0;
        List<SchemaBackfillExecutionResponse.BackfillFailureDetail> failures = new ArrayList<>();

        for (EntityRecord record : recordsToMigrate) {
            processed++;
            try {
                // Apply defaults for newly added attributes and validate against target schema
                Map<String, Object> currentAttrs = record.getAttributes() != null ? record.getAttributes() : Map.of();
                Map<String, Object> finalAttributes = applyAttributeDefaults(entityTypeId, currentAttrs);

                validateRelationPickerAttributes(entityTypeId, finalAttributes);
                schemaValidationService.validatePayload(entityTypeId, finalAttributes);

                record.setAttributes(finalAttributes);
                record.setSchemaVersion(targetVersion);
                entityRecordRepository.save(record);
                migrated++;
            } catch (Exception e) {
                failed++;
                failures.add(new SchemaBackfillExecutionResponse.BackfillFailureDetail(
                        record.getId(),
                        e.getMessage()
                ));
                log.warn("Backfill migration skipped for record ID {}: {}", record.getId(), e.getMessage());
            }
        }

        return new SchemaBackfillExecutionResponse(
                entityTypeId,
                targetVersion,
                processed,
                migrated,
                failed,
                failures
        );
    }

    @Transactional
    public EntityRecordResponse createEntityRecord(Long entityTypeId, CreateRecordRequest request) {
        return getOrCreatePipeline().executeCreate(entityTypeId, request);
    }

    @Transactional
    public EntityRecordResponse updateEntityRecord(Long entityTypeId, Long recordId, UpdateRecordRequest request) {
        return updateEntityRecord(entityTypeId, recordId, request, null);
    }

    @Transactional
    public EntityRecordResponse updateEntityRecord(Long entityTypeId, Long recordId, UpdateRecordRequest request, String ifMatchHeader) {
        return getOrCreatePipeline().executeUpdate(entityTypeId, recordId, request, ifMatchHeader);
    }

    @Transactional
    public EntityRecordResponse transitionRecordState(Long entityTypeId, Long recordId, String action, Map<String, Object> additionalAttributes) {
        EntityType entityType = entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityType not found with id: " + entityTypeId));

        if (Boolean.TRUE.equals(entityType.getIsComposite())) {
            throw new UnsupportedOperationException("Composite entity types are strictly virtual and read-only. Direct mutations are forbidden.");
        }

        EntityRecord record = entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(entityTypeId, recordId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityRecord not found with id: " + recordId + " for entityTypeId: " + entityTypeId));

        Map<String, Object> currentAttributes = new HashMap<>(record.getAttributes() != null ? record.getAttributes() : Map.of());
        if (additionalAttributes != null && !additionalAttributes.isEmpty()) {
            currentAttributes.putAll(additionalAttributes);
        }

        if (entityLifecycleService != null) {
            entityLifecycleService.validateAndExecuteTransition(record, action, currentAttributes);
        }

        validatePayloadSize(currentAttributes);
        validateRelationPickerAttributes(entityTypeId, currentAttributes);
        schemaValidationService.validatePayload(entityTypeId, currentAttributes);

        record.setAttributes(currentAttributes);
        record.setSchemaVersion(entityType.getSchemaVersion() != null ? entityType.getSchemaVersion() : 1L);
        EntityRecord saved = entityRecordRepository.save(record);

        if (outboxEventPublisher != null) {
            outboxEventPublisher.publish("entity_record", String.valueOf(saved.getId()), "RECORD_TRANSITIONED", saved.getTenantId(), saved.getAttributes());
        }

        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public EntityRecordResponse patchEntityRecord(Long entityTypeId, Long recordId, PatchRecordRequest request) {
        return patchEntityRecord(entityTypeId, recordId, request, null);
    }

    @Transactional
    public EntityRecordResponse patchEntityRecord(Long entityTypeId, Long recordId, PatchRecordRequest request, String ifMatchHeader) {
        return getOrCreatePipeline().executePatch(entityTypeId, recordId, request, ifMatchHeader);
    }

    /**
     * Executes a 3-way auto-merge across disjoint attribute mutations.
     * If an attribute was modified by both incoming client and current database state with conflicting values,
     * throws {@link MetadataConflictException}.
     *
     * @param base original state when client loaded the record
     * @param current current state in the database
     * @param incoming new changes from the client
     * @return successfully merged attributes
     */
    public Map<String, Object> autoMergeAttributes(
            Map<String, Object> base,
            Map<String, Object> current,
            Map<String, Object> incoming) {
        return getOrCreatePipeline().autoMergeAttributes(base, current, incoming);
    }

    @Transactional
    public void deleteEntityRecord(Long entityTypeId, Long recordId) {
        getOrCreatePipeline().executeDelete(entityTypeId, recordId);
    }

    @Transactional(readOnly = true)
    public List<RecordAuditLogResponse> getRecordAuditLogs(Long entityTypeId, Long recordId) {
        return getOrCreatePipeline().getRecordAuditLogs(entityTypeId, recordId);
    }

    @Transactional(readOnly = true)
    public RestorePreviewResponse previewRestoreRecordVersion(Long entityTypeId, Long recordId, Long auditLogId) {
        return getOrCreatePipeline().previewRestore(entityTypeId, recordId, auditLogId);
    }

    @Transactional
    public EntityRecordResponse restoreRecordToAuditVersion(Long entityTypeId, Long recordId, Long auditLogId) {
        return getOrCreatePipeline().executeRestore(entityTypeId, recordId, auditLogId);
    }

    private void validateRelationPickerAttributes(Long entityTypeId, Map<String, Object> attributes) {
        if (attributes == null || attributes.isEmpty()) return;
        List<AttributeDefinition> definitions = attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(entityTypeId);
        for (AttributeDefinition def : definitions) {
            if (Boolean.TRUE.equals(def.getIsArchived())) continue;
            if ("relation_picker".equalsIgnoreCase(def.getUiComponent())) {
                Object val = attributes.get(def.getSystemName());
                if (val != null) {
                    Map<String, Object> options = def.getOptions() != null ? def.getOptions() : Map.of();
                    Object targetTypeIdObj = options.get("targetEntityTypeId");
                    if (targetTypeIdObj != null) {
                        Long targetTypeId = targetTypeIdObj instanceof Number n ? n.longValue() : Long.parseLong(targetTypeIdObj.toString());
                        Long targetRecordId = val instanceof Number n ? n.longValue() : Long.parseLong(val.toString());
                        boolean exists = entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(targetTypeId, targetRecordId).isPresent();
                        if (!exists) {
                            throw new MetadataNotFoundException("Referenced target entity record with id " + targetRecordId 
                                    + " does not exist for entity type " + targetTypeId);
                        }
                    }
                }
            }
        }
    }

    // ==========================================
    // 4. Relationship Types Lifecycle
    // ==========================================

    public Page<RelationshipTypeResponse> getRelationshipTypes(PageRequest pageRequest) {
        org.springframework.data.domain.Page<RelationshipType> springPage = relationshipTypeRepository.findAllByDeletedDateIsNull(toSpringPageRequest(pageRequest));
        return pageBuilder.build(
                pageRequest,
                springPage::getTotalElements,
                () -> springPage.getContent().stream().map(MetadataDtoMapper::toResponse).collect(Collectors.toList())
        );
    }

    public RelationshipTypeResponse getRelationshipType(Long id) {
        RelationshipType type = relationshipTypeRepository.findByIdAndDeletedDateIsNull(id)
                .orElseThrow(() -> new MetadataNotFoundException("RelationshipType not found with id: " + id));
        return MetadataDtoMapper.toResponse(type);
    }

    @Transactional
    public RelationshipTypeResponse createRelationshipType(CreateRelationshipTypeRequest request) {
        if (relationshipTypeRepository.existsBySystemNameAndDeletedDateIsNull(request.systemName().trim())) {
            throw new MetadataConflictException("RelationshipType with systemName '" + request.systemName() + "' already exists");
        }

        EntityType source = null;
        if (request.sourceEntityTypeId() != null) {
            source = entityTypeRepository.findByIdAndDeletedDateIsNull(request.sourceEntityTypeId())
                    .orElseThrow(() -> new MetadataNotFoundException("Source EntityType not found with id: " + request.sourceEntityTypeId()));
        }

        EntityType target = null;
        if (request.targetEntityTypeId() != null) {
            target = entityTypeRepository.findByIdAndDeletedDateIsNull(request.targetEntityTypeId())
                    .orElseThrow(() -> new MetadataNotFoundException("Target EntityType not found with id: " + request.targetEntityTypeId()));
        }

        RelationshipType type = MetadataDtoMapper.toEntity(request, source, target);
        RelationshipType saved = relationshipTypeRepository.save(type);
        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public RelationshipTypeResponse updateRelationshipType(Long id, UpdateRelationshipTypeRequest request) {
        RelationshipType type = relationshipTypeRepository.findByIdAndDeletedDateIsNull(id)
                .orElseThrow(() -> new MetadataNotFoundException("RelationshipType not found with id: " + id));

        if (request.version() != null && !request.version().equals(type.getVersion())) {
            throw new MetadataConflictException("Optimistic lock conflict: RelationshipType version mismatch (expected: " 
                    + type.getVersion() + ", actual: " + request.version() + ")");
        }

        if (request.description() != null) {
            type.setDescription(request.description().trim());
        }
        if (request.sourceEntityTypeId() != null) {
            EntityType source = entityTypeRepository.findByIdAndDeletedDateIsNull(request.sourceEntityTypeId())
                    .orElseThrow(() -> new MetadataNotFoundException("Source EntityType not found with id: " + request.sourceEntityTypeId()));
            type.setSourceEntityType(source);
        }
        if (request.targetEntityTypeId() != null) {
            EntityType target = entityTypeRepository.findByIdAndDeletedDateIsNull(request.targetEntityTypeId())
                    .orElseThrow(() -> new MetadataNotFoundException("Target EntityType not found with id: " + request.targetEntityTypeId()));
            type.setTargetEntityType(target);
        }
        if (request.cardinality() != null) {
            type.setCardinality(request.cardinality());
        }

        RelationshipType saved = relationshipTypeRepository.save(type);
        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public void deleteRelationshipType(Long id, boolean force) {
        RelationshipType type = relationshipTypeRepository.findByIdAndDeletedDateIsNull(id)
                .orElseThrow(() -> new MetadataNotFoundException("RelationshipType not found with id: " + id));

        boolean hasRelationships = entityRelationshipRepository.existsByRelationshipTypeIdAndDeletedDateIsNull(id);
        if (hasRelationships && !force) {
            throw new MetadataConflictException("Cannot delete RelationshipType with existing entity relationships without force=true");
        }

        type.setDeletedDate(LocalDateTime.now());
        relationshipTypeRepository.save(type);
    }

    // ==========================================
    // 5. Entity Relationships Lifecycle
    // ==========================================

    public Page<EntityRelationshipResponse> getRecordRelationships(Long entityRecordId, String direction, PageRequest pageRequest) {
        entityRecordRepository.findByIdAndDeletedDateIsNull(entityRecordId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityRecord not found with id: " + entityRecordId));

        org.springframework.data.domain.Pageable pageable = toSpringPageRequest(pageRequest);
        org.springframework.data.domain.Page<EntityRelationship> springPage;

        if ("outgoing".equalsIgnoreCase(direction)) {
            springPage = entityRelationshipRepository.findBySourceEntityIdAndDeletedDateIsNull(entityRecordId, pageable);
        } else if ("incoming".equalsIgnoreCase(direction)) {
            springPage = entityRelationshipRepository.findByTargetEntityIdAndDeletedDateIsNull(entityRecordId, pageable);
        } else {
            springPage = entityRelationshipRepository.findBySourceEntityIdOrTargetEntityIdAndDeletedDateIsNull(entityRecordId, entityRecordId, pageable);
        }

        return pageBuilder.build(
                pageRequest,
                springPage::getTotalElements,
                () -> springPage.getContent().stream().map(MetadataDtoMapper::toResponse).collect(Collectors.toList())
        );
    }

    @Transactional
    public EntityRelationshipResponse createEntityRelationship(Long sourceRecordId, CreateEntityRelationshipRequest request) {
        EntityRecord source = entityRecordRepository.findByIdAndDeletedDateIsNull(sourceRecordId)
                .orElseThrow(() -> new MetadataNotFoundException("Source EntityRecord not found with id: " + sourceRecordId));

        EntityRecord target = entityRecordRepository.findByIdAndDeletedDateIsNull(request.targetEntityId())
                .orElseThrow(() -> new MetadataNotFoundException("Target EntityRecord not found with id: " + request.targetEntityId()));

        RelationshipType relType = relationshipTypeRepository.findByIdAndDeletedDateIsNull(request.relationshipTypeId())
                .orElseThrow(() -> new MetadataNotFoundException("RelationshipType not found with id: " + request.relationshipTypeId()));

        // Tenant match check
        if (source.getTenantId() != null && target.getTenantId() != null && !source.getTenantId().equals(target.getTenantId())) {
            throw new MetadataConflictException("Cross-tenant relationships are not permitted (source tenant: " 
                    + source.getTenantId() + ", target tenant: " + target.getTenantId() + ")");
        }

        // Validate source entity type constraint if defined
        if (relType.getSourceEntityType() != null && !relType.getSourceEntityType().getId().equals(source.getEntityType().getId())) {
            throw new MetadataConflictException("Source record entity type " + source.getEntityType().getId() 
                    + " does not match allowed relationship source type " + relType.getSourceEntityType().getId());
        }

        // Validate target entity type constraint if defined
        if (relType.getTargetEntityType() != null && !relType.getTargetEntityType().getId().equals(target.getEntityType().getId())) {
            throw new MetadataConflictException("Target record entity type " + target.getEntityType().getId() 
                    + " does not match allowed relationship target type " + relType.getTargetEntityType().getId());
        }

        // Triplet uniqueness check
        if (entityRelationshipRepository.existsBySourceEntityIdAndTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(
                sourceRecordId, request.targetEntityId(), request.relationshipTypeId())) {
            throw new MetadataConflictException("Relationship between source record " + sourceRecordId 
                    + " and target record " + request.targetEntityId() 
                    + " with relationship type " + request.relationshipTypeId() + " already exists");
        }

        // Cardinality checks
        String cardinality = relType.getCardinality() != null ? relType.getCardinality().toUpperCase() : "MANY_TO_MANY";
        if ("ONE_TO_ONE".equals(cardinality) || "ONE_TO_MANY".equals(cardinality)) {
            // Target can only have ONE incoming relationship of this type
            long incomingCount = entityRelationshipRepository.countByTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(
                    request.targetEntityId(), request.relationshipTypeId());
            if (incomingCount > 0) {
                throw new MetadataConflictException("Cardinality violation: Target record already has an incoming relationship of type " + relType.getSystemName());
            }
        }
        if ("ONE_TO_ONE".equals(cardinality) || "MANY_TO_ONE".equals(cardinality)) {
            // Source can only have ONE outgoing relationship of this type
            long outgoingCount = entityRelationshipRepository.countBySourceEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(
                    sourceRecordId, request.relationshipTypeId());
            if (outgoingCount > 0) {
                throw new MetadataConflictException("Cardinality violation: Source record already has an outgoing relationship of type " + relType.getSystemName());
            }
        }

        EntityRelationship rel = new EntityRelationship();
        rel.setSourceEntity(source);
        rel.setTargetEntity(target);
        rel.setRelationshipType(relType);
        rel.setEdgeMetadata(request.edgeMetadata() != null ? request.edgeMetadata() : Map.of());

        EntityRelationship saved = entityRelationshipRepository.save(rel);
        return MetadataDtoMapper.toResponse(saved);
    }

    @Transactional
    public void deleteEntityRelationship(Long sourceRecordId, Long relationshipId) {
        entityRecordRepository.findByIdAndDeletedDateIsNull(sourceRecordId)
                .orElseThrow(() -> new MetadataNotFoundException("Source EntityRecord not found with id: " + sourceRecordId));

        EntityRelationship rel = entityRelationshipRepository.findByIdAndDeletedDateIsNull(relationshipId)
                .orElseThrow(() -> new MetadataNotFoundException("EntityRelationship not found with id: " + relationshipId));

        if (!rel.getSourceEntity().getId().equals(sourceRecordId) && !rel.getTargetEntity().getId().equals(sourceRecordId)) {
            throw new MetadataConflictException("Relationship " + relationshipId + " is not connected to record " + sourceRecordId);
        }

        rel.setDeletedDate(LocalDateTime.now());
        entityRelationshipRepository.save(rel);
    }

    private void validatePayloadSize(Map<String, Object> attributes) {
        if (attributes == null || attributes.isEmpty()) {
            return;
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

    public static boolean isDangerousRegex(String regex) {
        if (regex == null || regex.isBlank()) {
            return false;
        }
        return DANGEROUS_REGEX_PATTERN.matcher(regex).find();
    }

    private void validateNoCompositeDependencyOnAttribute(Long entityTypeId, String attributeSystemName) {
        List<EntityType> activeEntities = entityTypeRepository.findAllByDeletedDateIsNull();
        for (EntityType et : activeEntities) {
            if (Boolean.TRUE.equals(et.getIsComposite()) && et.getCompositeSpec() != null) {
                if (isAttributeReferencedInSpec(et.getCompositeSpec(), entityTypeId, attributeSystemName)) {
                    throw new MetadataConflictException("Cannot delete or archive base attribute '" + attributeSystemName 
                            + "' because it is actively referenced in composite entity specification for '" + et.getName() + "' (ID: " + et.getId() + ")");
                }
            }
        }
    }

    private void validateNoCompositeDependencyOnEntityType(Long entityTypeId) {
        List<EntityType> activeEntities = entityTypeRepository.findAllByDeletedDateIsNull();
        for (EntityType et : activeEntities) {
            if (Boolean.TRUE.equals(et.getIsComposite()) && et.getCompositeSpec() != null) {
                if (isEntityTypeReferencedInSpec(et.getCompositeSpec(), entityTypeId)) {
                    throw new MetadataConflictException("Cannot delete base entity type '" + entityTypeId 
                            + "' because it is actively referenced in composite entity specification for '" + et.getName() + "' (ID: " + et.getId() + ")");
                }
            }
        }
    }

    private boolean isAttributeReferencedInSpec(com.acc.domain.metadata.CompositeSpec spec, Long entityTypeId, String attributeSystemName) {
        if (spec == null || attributeSystemName == null) return false;
        if (Objects.equals(spec.rootEntityTypeId(), entityTypeId) && spec.fields() != null) {
            for (com.acc.domain.metadata.CompositeField field : spec.fields()) {
                if (attributeSystemName.equalsIgnoreCase(field.sourceAttribute())) {
                    return true;
                }
            }
        }
        if (spec.children() != null) {
            for (com.acc.domain.metadata.CompositeNode child : spec.children()) {
                if (isAttributeReferencedInNode(child, entityTypeId, attributeSystemName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean isAttributeReferencedInNode(com.acc.domain.metadata.CompositeNode node, Long entityTypeId, String attributeSystemName) {
        if (node == null || attributeSystemName == null) return false;
        if (Objects.equals(node.targetEntityTypeId(), entityTypeId)) {
            if (node.fields() != null) {
                for (com.acc.domain.metadata.CompositeField field : node.fields()) {
                    if (attributeSystemName.equalsIgnoreCase(field.sourceAttribute())) {
                        return true;
                    }
                }
            }
            if (attributeSystemName.equalsIgnoreCase(node.foreignKeyAttribute())) {
                return true;
            }
        }
        if (node.children() != null) {
            for (com.acc.domain.metadata.CompositeNode grandchild : node.children()) {
                if (isAttributeReferencedInNode(grandchild, entityTypeId, attributeSystemName)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean isEntityTypeReferencedInSpec(com.acc.domain.metadata.CompositeSpec spec, Long entityTypeId) {
        if (spec == null || entityTypeId == null) return false;
        if (Objects.equals(spec.rootEntityTypeId(), entityTypeId)) {
            return true;
        }
        if (spec.children() != null) {
            for (com.acc.domain.metadata.CompositeNode child : spec.children()) {
                if (isEntityTypeReferencedInNode(child, entityTypeId)) {
                    return true;
                }
            }
        }
        return false;
    }

    private boolean isEntityTypeReferencedInNode(com.acc.domain.metadata.CompositeNode node, Long entityTypeId) {
        if (node == null || entityTypeId == null) return false;
        if (Objects.equals(node.targetEntityTypeId(), entityTypeId)) {
            return true;
        }
        if (node.children() != null) {
            for (com.acc.domain.metadata.CompositeNode grandchild : node.children()) {
                if (isEntityTypeReferencedInNode(grandchild, entityTypeId)) {
                    return true;
                }
            }
        }
        return false;
    }
}
