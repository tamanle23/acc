package com.acc.service;

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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MetadataServiceTest {

    @Mock
    private EntityTypeRepository entityTypeRepository;
    @Mock
    private AttributeDefinitionRepository attributeDefinitionRepository;
    @Mock
    private EntityRecordRepository entityRecordRepository;
    @Mock
    private RelationshipTypeRepository relationshipTypeRepository;
    @Mock
    private EntityRelationshipRepository entityRelationshipRepository;
    @Mock
    private SchemaValidationService schemaValidationService;
    @Mock
    private ApplicationEventPublisher eventPublisher;
    @Mock
    private PageBuilder pageBuilder;
    @Spy
    private com.fasterxml.jackson.databind.ObjectMapper objectMapper = new com.fasterxml.jackson.databind.ObjectMapper();

    @InjectMocks
    private MetadataService metadataService;

    private PageRequest defaultPageRequest;
    private org.springframework.data.domain.Page springPageMock;
    private Page customPageMock;

    @BeforeEach
    void setUp() {
        defaultPageRequest = new PageRequest();
        defaultPageRequest.setNumber(1);
        defaultPageRequest.setSize(10);

        springPageMock = mock(org.springframework.data.domain.Page.class);
        customPageMock = new Page();

        lenient().when(springPageMock.getContent()).thenReturn(Collections.emptyList());
        lenient().when(springPageMock.getTotalElements()).thenReturn(0L);
        lenient().when(pageBuilder.build(any(), any(), any())).thenAnswer(inv -> {
            java.util.function.LongSupplier countSupplier = inv.getArgument(1);
            java.util.function.Supplier<List<?>> contentSupplier = inv.getArgument(2);
            if (countSupplier != null) countSupplier.getAsLong();
            if (contentSupplier != null) contentSupplier.get();
            return customPageMock;
        });
    }

    @Test
    void testGetEntityTypes() {
        when(entityTypeRepository.findAllByDeletedDateIsNull(any(org.springframework.data.domain.PageRequest.class))).thenReturn(springPageMock);
        when(pageBuilder.build(eq(defaultPageRequest), any(), any())).thenReturn(customPageMock);

        Page<EntityTypeResponse> result = metadataService.getEntityTypes(defaultPageRequest);

        assertNotNull(result);
        verify(entityTypeRepository).findAllByDeletedDateIsNull(any(org.springframework.data.domain.PageRequest.class));
        verify(pageBuilder).build(eq(defaultPageRequest), any(), any());
    }

    @Test
    void testCreateEntityType_Success() {
        CreateEntityTypeRequest request = new CreateEntityTypeRequest("customer", "Customer", "Customer entity");
        EntityType savedEntity = new EntityType();
        savedEntity.setId(1L);
        savedEntity.setName("Customer");
        savedEntity.setSystemName("customer");

        when(entityTypeRepository.existsBySystemNameAndDeletedDateIsNull("customer")).thenReturn(false);
        when(entityTypeRepository.save(any(EntityType.class))).thenReturn(savedEntity);

        EntityTypeResponse result = metadataService.createEntityType(request);

        assertNotNull(result);
        assertEquals(1L, result.id());
        assertEquals("Customer", result.name());
        assertEquals("customer", result.systemName());
        verify(entityTypeRepository).save(any(EntityType.class));
    }

    @Test
    void testCreateEntityType_DuplicateConflict() {
        CreateEntityTypeRequest request = new CreateEntityTypeRequest("customer", "Customer", "Customer entity");
        when(entityTypeRepository.existsBySystemNameAndDeletedDateIsNull("customer")).thenReturn(true);

        assertThrows(MetadataConflictException.class, () -> metadataService.createEntityType(request));
        verify(entityTypeRepository, never()).save(any());
    }

    @Test
    void testCreateAttributeDefinition_Success() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        CreateAttributeRequest request = new CreateAttributeRequest("email", "Email", "string", "text", true, false, null, null);
        AttributeDefinition savedAttr = new AttributeDefinition();
        savedAttr.setId(10L);
        savedAttr.setEntityType(type);
        savedAttr.setName("Email");
        savedAttr.setSystemName("email");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(typeId)).thenReturn(Collections.emptyList());
        when(attributeDefinitionRepository.save(any(AttributeDefinition.class))).thenReturn(savedAttr);

        AttributeDefinitionResponse result = metadataService.createAttributeDefinition(typeId, request);

        assertNotNull(result);
        assertEquals(10L, result.id());
        assertEquals("email", result.systemName());
        verify(attributeDefinitionRepository).save(any(AttributeDefinition.class));
        verify(eventPublisher).publishEvent(any(AttributeDefinitionUpdatedEvent.class));
    }

    @Test
    void testCreateAttributeDefinition_DuplicateConflict() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        CreateAttributeRequest request = new CreateAttributeRequest("email", "Email", "string", "text", true, false, null, null);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        AttributeDefinition existingAttr = new AttributeDefinition(); existingAttr.setSystemName("email");
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(typeId)).thenReturn(List.of(existingAttr));

        assertThrows(MetadataConflictException.class, () -> metadataService.createAttributeDefinition(typeId, request));
        verify(attributeDefinitionRepository, never()).save(any());
    }

    @Test
    void testCreateEntityRecord_Success() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        Map<String, Object> attributes = new HashMap<>();
        attributes.put("email", "test@example.com");
        CreateRecordRequest request = new CreateRecordRequest(attributes, "tenant-1");

        EntityRecord savedRecord = new EntityRecord();
        savedRecord.setId(100L);
        savedRecord.setEntityType(type);
        savedRecord.setAttributes(attributes);
        savedRecord.setTenantId("tenant-1");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenReturn(savedRecord);

        EntityRecordResponse result = metadataService.createEntityRecord(typeId, request);

        assertNotNull(result);
        assertEquals(100L, result.id());
        assertEquals("tenant-1", result.tenantId());
        verify(schemaValidationService).validatePayload(typeId, attributes);
        verify(entityRecordRepository).save(any(EntityRecord.class));
    }

    @Test
    void testCreateEntityRecord_AppliesAttributeDefaults() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        AttributeDefinition defStatus = new AttributeDefinition();
        defStatus.setSystemName("status");
        defStatus.setDataType("string");
        defStatus.setDefaultValue("DRAFT");
        defStatus.setIsArchived(false);

        AttributeDefinition defCount = new AttributeDefinition();
        defCount.setSystemName("count");
        defCount.setDataType("integer");
        defCount.setDefaultValue("10");
        defCount.setIsArchived(false);

        AttributeDefinition defArchived = new AttributeDefinition();
        defArchived.setSystemName("old_prop");
        defArchived.setDataType("string");
        defArchived.setDefaultValue("OLD");
        defArchived.setIsArchived(true);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId))
                .thenReturn(List.of(defStatus, defCount, defArchived));

        Map<String, Object> inputAttributes = new HashMap<>();
        inputAttributes.put("name", "Item");
        CreateRecordRequest request = new CreateRecordRequest(inputAttributes, "tenant-1");

        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(i -> {
            EntityRecord r = i.getArgument(0);
            r.setId(101L);
            return r;
        });

        EntityRecordResponse response = metadataService.createEntityRecord(typeId, request);

        assertNotNull(response);
        assertEquals("DRAFT", response.attributes().get("status"));
        assertEquals(10L, response.attributes().get("count"));
        assertNull(response.attributes().get("old_prop"));
        assertEquals("Item", response.attributes().get("name"));
    }

    @Test
    void testGetEntityRecords_WithFiltersAndTenant() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));

        AttributeDefinition defEmail = new AttributeDefinition();
        defEmail.setSystemName("email");
        defEmail.setDataType("string");
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId))
                .thenReturn(List.of(defEmail));

        EntityRecord record = new EntityRecord();
        record.setId(100L);
        record.setEntityType(type);
        record.setAttributes(Map.of("email", "john@example.com"));

        org.springframework.data.domain.Page<EntityRecord> springPage = new org.springframework.data.domain.PageImpl<>(
                List.of(record),
                org.springframework.data.domain.PageRequest.of(0, 10),
                1
        );
        when(entityRecordRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(springPage);

        PageRequest pageRequest = new PageRequest();
        pageRequest.setNumber(1);
        pageRequest.setSize(10);

        when(pageBuilder.build(eq(pageRequest), any(), any())).thenReturn(customPageMock);

        Map<String, Map<String, String>> filterParams = Map.of("email", Map.of("contains", "john"));

        Page<EntityRecordResponse> result = metadataService.getEntityRecords(
                typeId,
                pageRequest,
                filterParams,
                "createdDate",
                "desc",
                "tenant-1"
        );

        assertNotNull(result);
        assertSame(customPageMock, result);
        verify(entityRecordRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class));
        verify(pageBuilder).build(eq(pageRequest), any(), any());
    }

    @Test
    void testGetEntityRecords_WithEqualityContainmentFilters() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));

        AttributeDefinition defStatus = new AttributeDefinition();
        defStatus.setSystemName("status");
        defStatus.setDataType("string");

        AttributeDefinition defAge = new AttributeDefinition();
        defAge.setSystemName("age");
        defAge.setDataType("number");

        AttributeDefinition defActive = new AttributeDefinition();
        defActive.setSystemName("active");
        defActive.setDataType("boolean");

        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId))
                .thenReturn(List.of(defStatus, defAge, defActive));

        EntityRecord record = new EntityRecord();
        record.setId(101L);
        record.setEntityType(type);
        record.setAttributes(Map.of("status", "PUBLISHED", "age", 30, "active", true));

        org.springframework.data.domain.Page<EntityRecord> springPage = new org.springframework.data.domain.PageImpl<>(
                List.of(record),
                org.springframework.data.domain.PageRequest.of(0, 10),
                1
        );
        when(entityRecordRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(springPage);

        PageRequest pageRequest = new PageRequest();
        pageRequest.setNumber(1);
        pageRequest.setSize(10);

        when(pageBuilder.build(eq(pageRequest), any(), any())).thenReturn(customPageMock);

        // Filter combining multiple equality checks across different data types
        Map<String, Map<String, String>> filterParams = Map.of(
                "status", Map.of("eq", "PUBLISHED"),
                "age", Map.of("eq", "30"),
                "active", Map.of("eq", "true")
        );

        Page<EntityRecordResponse> result = metadataService.getEntityRecords(
                typeId,
                pageRequest,
                filterParams,
                "id",
                "asc",
                "tenant-alpha"
        );

        assertNotNull(result);
        assertSame(customPageMock, result);
        verify(entityRecordRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class));
        verify(pageBuilder).build(eq(pageRequest), any(), any());
    }

    @Test
    void testCreateEntityRecord_ThrowsIfTypeNotFound() {
        Long typeId = 99L;
        CreateRecordRequest request = new CreateRecordRequest(Map.of(), "tenant-1");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.empty());

        assertThrows(MetadataNotFoundException.class, () -> metadataService.createEntityRecord(typeId, request));

        verify(schemaValidationService, never()).validatePayload(any(), any());
        verify(entityRecordRepository, never()).save(any());
    }

    @Test
    void testGetEntityType_Success() {
        EntityType type = new EntityType();
        type.setId(1L);
        type.setName("Customer");
        type.setSystemName("customer");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));

        EntityTypeResponse result = metadataService.getEntityType(1L);
        assertNotNull(result);
        assertEquals(1L, result.id());
        assertEquals("Customer", result.name());
    }

    @Test
    void testGetCompiledSchema_Success() {
        EntityType type = new EntityType();
        type.setId(1L);
        type.setSchemaVersion(5L);

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        com.fasterxml.jackson.databind.JsonNode node = mapper.createObjectNode().put("type", "object");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(schemaValidationService.compileSchemaNode(1L)).thenReturn(node);

        CompiledSchemaResponse result = metadataService.getCompiledSchema(1L);
        assertNotNull(result);
        assertEquals(1L, result.entityTypeId());
        assertEquals(5L, result.schemaVersion());
        assertEquals(node, result.schema());
    }

    @Test
    void testUpdateEntityType_Success() {
        EntityType type = new EntityType();
        type.setId(1L);
        type.setName("Old Name");
        type.setSystemName("customer");
        type.setVersion(0L);

        UpdateEntityTypeRequest request = new UpdateEntityTypeRequest("New Name", "New Desc", 0L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(entityTypeRepository.save(any(EntityType.class))).thenAnswer(i -> i.getArgument(0));

        EntityTypeResponse result = metadataService.updateEntityType(1L, request);
        assertNotNull(result);
        assertEquals("New Name", result.name());
        assertEquals("New Desc", result.description());
        verify(entityTypeRepository).save(type);
    }

    @Test
    void testUpdateEntityType_ConflictOnVersionMismatch() {
        EntityType type = new EntityType();
        type.setId(1L);
        type.setVersion(1L);

        UpdateEntityTypeRequest request = new UpdateEntityTypeRequest("New Name", "New Desc", 0L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));

        assertThrows(MetadataConflictException.class, () -> metadataService.updateEntityType(1L, request));
        verify(entityTypeRepository, never()).save(any());
    }

    @Test
    void testDeleteEntityType_CascadesSoftDelete() {
        EntityType type = new EntityType();
        type.setId(1L);

        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(10L);

        EntityRecord record = new EntityRecord();
        record.setId(100L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(1L)).thenReturn(java.util.List.of(attr));
        when(entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(1L)).thenReturn(java.util.List.of(record));

        metadataService.deleteEntityType(1L);

        assertNotNull(type.getDeletedDate());
        assertNotNull(attr.getDeletedDate());
        assertNotNull(record.getDeletedDate());
        verify(entityTypeRepository).save(type);
        verify(attributeDefinitionRepository).save(attr);
        verify(entityRecordRepository).save(record);
    }

    @Test
    void testUpdateAttributeDefinition_Success() {
        EntityType type = new EntityType();
        type.setId(1L);

        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(10L);
        attr.setEntityType(type);
        attr.setDataType("string");
        attr.setUiComponent("text");
        attr.setVersion(0L);

        UpdateAttributeRequest request = new UpdateAttributeRequest("Full Name", "textarea", true, false, null, null, null, 0L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 10L)).thenReturn(Optional.of(attr));
        when(attributeDefinitionRepository.save(any(AttributeDefinition.class))).thenAnswer(i -> i.getArgument(0));

        AttributeDefinitionResponse result = metadataService.updateAttributeDefinition(1L, 10L, request);
        assertNotNull(result);
        assertEquals("Full Name", result.name());
        assertEquals("textarea", result.uiComponent());
        verify(attributeDefinitionRepository).save(attr);
        verify(eventPublisher).publishEvent(any(AttributeDefinitionUpdatedEvent.class));
    }

    @Test
    void testDeleteAttributeDefinition_GuardedThrowsWhenValuesExist() {
        EntityType type = new EntityType();
        type.setId(1L);

        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(10L);
        attr.setSystemName("email");

        EntityRecord record = new EntityRecord();
        record.setAttributes(Map.of("email", "john@example.com"));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 10L)).thenReturn(Optional.of(attr));
        when(entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(1L)).thenReturn(java.util.List.of(record));

        assertThrows(MetadataConflictException.class, () -> metadataService.deleteAttributeDefinition(1L, 10L, false));
        assertNull(attr.getDeletedDate());
        verify(attributeDefinitionRepository, never()).save(any());
    }

    @Test
    void testDeleteAttributeDefinition_ForceSuccess() {
        EntityType type = new EntityType();
        type.setId(1L);

        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(10L);
        attr.setSystemName("email");

        EntityRecord record = new EntityRecord();
        record.setAttributes(Map.of("email", "john@example.com"));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 10L)).thenReturn(Optional.of(attr));

        metadataService.deleteAttributeDefinition(1L, 10L, true);

        assertNotNull(attr.getDeletedDate());
        verify(attributeDefinitionRepository).save(attr);
        verify(eventPublisher).publishEvent(any(AttributeDefinitionUpdatedEvent.class));
    }

    @Test
    void testArchiveAndUnarchiveAttribute() {
        EntityType type = new EntityType();
        type.setId(1L);

        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(10L);
        attr.setIsArchived(false);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 10L)).thenReturn(Optional.of(attr));
        when(attributeDefinitionRepository.save(any(AttributeDefinition.class))).thenAnswer(i -> i.getArgument(0));

        metadataService.archiveAttributeDefinition(1L, 10L);
        assertTrue(attr.getIsArchived());

        metadataService.unarchiveAttributeDefinition(1L, 10L);
        assertFalse(attr.getIsArchived());
    }

    @Test
    void testReorderAttributes() {
        EntityType type = new EntityType();
        type.setId(1L);

        AttributeDefinition attr1 = new AttributeDefinition();
        attr1.setId(10L);
        attr1.setDisplayOrder(0);

        AttributeDefinition attr2 = new AttributeDefinition();
        attr2.setId(20L);
        attr2.setDisplayOrder(1);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findAllByIdInAndEntityTypeIdAndDeletedDateIsNull(java.util.List.of(20L, 10L), 1L)).thenReturn(java.util.List.of(attr1, attr2));

        ReorderAttributesRequest request = new ReorderAttributesRequest(java.util.List.of(20L, 10L));
        metadataService.reorderAttributes(1L, request);

        assertEquals(0, attr2.getDisplayOrder());
        assertEquals(1, attr1.getDisplayOrder());
        verify(attributeDefinitionRepository).save(attr1);
        verify(attributeDefinitionRepository).save(attr2);
        verify(eventPublisher).publishEvent(any(AttributeDefinitionUpdatedEvent.class));
    }

    @Test
    void testUpdateEntityRecord_Success() {
        EntityType type = new EntityType();
        type.setId(1L);
        type.setSchemaVersion(2L);

        EntityRecord record = new EntityRecord();
        record.setId(100L);
        record.setEntityType(type);
        record.setAttributes(new HashMap<>(Map.of("name", "Old")));
        record.setVersion(0L);

        UpdateRecordRequest request = new UpdateRecordRequest(Map.of("name", "New"), 0L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 100L)).thenReturn(Optional.of(record));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(i -> i.getArgument(0));

        EntityRecordResponse result = metadataService.updateEntityRecord(1L, 100L, request);
        assertNotNull(result);
        assertEquals("New", result.attributes().get("name"));
        assertEquals(2L, record.getSchemaVersion());
        verify(schemaValidationService).validatePayload(1L, Map.of("name", "New"));
    }

    @Test
    void testPatchEntityRecord_Success() {
        EntityType type = new EntityType();
        type.setId(1L);
        type.setSchemaVersion(3L);

        Map<String, Object> initial = new HashMap<>();
        initial.put("first", "John");
        initial.put("last", "Doe");

        EntityRecord record = new EntityRecord();
        record.setId(100L);
        record.setEntityType(type);
        record.setAttributes(initial);
        record.setVersion(0L);

        PatchRecordRequest request = new PatchRecordRequest(Map.of("last", "Smith"), 0L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 100L)).thenReturn(Optional.of(record));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(i -> i.getArgument(0));

        EntityRecordResponse result = metadataService.patchEntityRecord(1L, 100L, request);
        assertNotNull(result);
        assertEquals("John", result.attributes().get("first"));
        assertEquals("Smith", result.attributes().get("last"));
        assertEquals(3L, record.getSchemaVersion());
    }

    @Test
    void testDeleteEntityRecord_SoftDelete() {
        EntityType type = new EntityType();
        type.setId(1L);

        EntityRecord record = new EntityRecord();
        record.setId(100L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(type));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 100L)).thenReturn(Optional.of(record));

        metadataService.deleteEntityRecord(1L, 100L);
        assertNotNull(record.getDeletedDate());
        verify(entityRecordRepository).save(record);
    }

    // ==========================================
    // Phase 5 Relationship Tests
    // ==========================================

    @Test
    void testCreateRelationshipType_Success() {
        CreateRelationshipTypeRequest request = new CreateRelationshipTypeRequest("authored_by", "Author relation", 1L, 2L, "MANY_TO_ONE");
        EntityType source = new EntityType();
        source.setId(1L);
        EntityType target = new EntityType();
        target.setId(2L);

        when(relationshipTypeRepository.existsBySystemNameAndDeletedDateIsNull("authored_by")).thenReturn(false);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(source));
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(2L)).thenReturn(Optional.of(target));

        RelationshipType savedType = new RelationshipType();
        savedType.setId(10L);
        savedType.setSystemName("authored_by");
        savedType.setDescription("Author relation");
        savedType.setSourceEntityType(source);
        savedType.setTargetEntityType(target);
        savedType.setCardinality("MANY_TO_ONE");

        when(relationshipTypeRepository.save(any(RelationshipType.class))).thenReturn(savedType);

        RelationshipTypeResponse response = metadataService.createRelationshipType(request);

        assertNotNull(response);
        assertEquals(10L, response.id());
        assertEquals("authored_by", response.systemName());
        assertEquals("MANY_TO_ONE", response.cardinality());
        assertEquals(1L, response.sourceEntityTypeId());
        assertEquals(2L, response.targetEntityTypeId());
    }

    @Test
    void testCreateRelationshipType_DuplicateConflict() {
        CreateRelationshipTypeRequest request = new CreateRelationshipTypeRequest("authored_by", "Author relation", null, null, null);
        when(relationshipTypeRepository.existsBySystemNameAndDeletedDateIsNull("authored_by")).thenReturn(true);

        assertThrows(MetadataConflictException.class, () -> metadataService.createRelationshipType(request));
        verify(relationshipTypeRepository, never()).save(any());
    }

    @Test
    void testCreateEntityRelationship_Success() {
        Long sourceRecordId = 100L;
        Long targetRecordId = 200L;
        Long relTypeId = 10L;

        EntityType sourceType = new EntityType();
        sourceType.setId(1L);
        EntityRecord sourceRecord = new EntityRecord();
        sourceRecord.setId(sourceRecordId);
        sourceRecord.setEntityType(sourceType);
        sourceRecord.setTenantId("t-1");

        EntityType targetType = new EntityType();
        targetType.setId(2L);
        EntityRecord targetRecord = new EntityRecord();
        targetRecord.setId(targetRecordId);
        targetRecord.setEntityType(targetType);
        targetRecord.setTenantId("t-1");

        RelationshipType relType = new RelationshipType();
        relType.setId(relTypeId);
        relType.setSystemName("authored_by");
        relType.setSourceEntityType(sourceType);
        relType.setTargetEntityType(targetType);
        relType.setCardinality("MANY_TO_ONE");

        when(entityRecordRepository.findByIdAndDeletedDateIsNull(sourceRecordId)).thenReturn(Optional.of(sourceRecord));
        when(entityRecordRepository.findByIdAndDeletedDateIsNull(targetRecordId)).thenReturn(Optional.of(targetRecord));
        when(relationshipTypeRepository.findByIdAndDeletedDateIsNull(relTypeId)).thenReturn(Optional.of(relType));
        when(entityRelationshipRepository.existsBySourceEntityIdAndTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(
                sourceRecordId, targetRecordId, relTypeId)).thenReturn(false);
        when(entityRelationshipRepository.countBySourceEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(
                sourceRecordId, relTypeId)).thenReturn(0L);

        EntityRelationship savedRel = new EntityRelationship();
        savedRel.setId(500L);
        savedRel.setSourceEntity(sourceRecord);
        savedRel.setTargetEntity(targetRecord);
        savedRel.setRelationshipType(relType);
        savedRel.setEdgeMetadata(Map.of("role", "Lead Author"));

        when(entityRelationshipRepository.save(any(EntityRelationship.class))).thenReturn(savedRel);

        CreateEntityRelationshipRequest request = new CreateEntityRelationshipRequest(targetRecordId, relTypeId, Map.of("role", "Lead Author"));
        EntityRelationshipResponse response = metadataService.createEntityRelationship(sourceRecordId, request);

        assertNotNull(response);
        assertEquals(500L, response.id());
        assertEquals(sourceRecordId, response.sourceEntityId());
        assertEquals(targetRecordId, response.targetEntityId());
        assertEquals(relTypeId, response.relationshipTypeId());
        assertEquals("Lead Author", response.edgeMetadata().get("role"));
    }

    @Test
    void testCreateEntityRelationship_CardinalityViolation() {
        Long sourceRecordId = 100L;
        Long targetRecordId = 200L;
        Long relTypeId = 10L;

        EntityType sourceType = new EntityType();
        sourceType.setId(1L);
        EntityRecord sourceRecord = new EntityRecord();
        sourceRecord.setId(sourceRecordId);
        sourceRecord.setEntityType(sourceType);

        EntityType targetType = new EntityType();
        targetType.setId(2L);
        EntityRecord targetRecord = new EntityRecord();
        targetRecord.setId(targetRecordId);
        targetRecord.setEntityType(targetType);

        RelationshipType relType = new RelationshipType();
        relType.setId(relTypeId);
        relType.setSystemName("manager_of");
        relType.setCardinality("ONE_TO_ONE");

        when(entityRecordRepository.findByIdAndDeletedDateIsNull(sourceRecordId)).thenReturn(Optional.of(sourceRecord));
        when(entityRecordRepository.findByIdAndDeletedDateIsNull(targetRecordId)).thenReturn(Optional.of(targetRecord));
        when(relationshipTypeRepository.findByIdAndDeletedDateIsNull(relTypeId)).thenReturn(Optional.of(relType));
        when(entityRelationshipRepository.countByTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(targetRecordId, relTypeId))
                .thenReturn(1L);

        CreateEntityRelationshipRequest request = new CreateEntityRelationshipRequest(targetRecordId, relTypeId, Map.of());

        assertThrows(MetadataConflictException.class, () -> metadataService.createEntityRelationship(sourceRecordId, request));
        verify(entityRelationshipRepository, never()).save(any());
    }

    @Test
    void testCreateEntityRelationship_CrossTenantRejected() {
        Long sourceRecordId = 100L;
        Long targetRecordId = 200L;
        Long relTypeId = 10L;

        EntityRecord sourceRecord = new EntityRecord();
        sourceRecord.setId(sourceRecordId);
        sourceRecord.setTenantId("tenant-A");

        EntityRecord targetRecord = new EntityRecord();
        targetRecord.setId(targetRecordId);
        targetRecord.setTenantId("tenant-B");

        RelationshipType relType = new RelationshipType();
        relType.setId(relTypeId);

        when(entityRecordRepository.findByIdAndDeletedDateIsNull(sourceRecordId)).thenReturn(Optional.of(sourceRecord));
        when(entityRecordRepository.findByIdAndDeletedDateIsNull(targetRecordId)).thenReturn(Optional.of(targetRecord));
        when(relationshipTypeRepository.findByIdAndDeletedDateIsNull(relTypeId)).thenReturn(Optional.of(relType));

        CreateEntityRelationshipRequest request = new CreateEntityRelationshipRequest(targetRecordId, relTypeId, Map.of());

        assertThrows(MetadataConflictException.class, () -> metadataService.createEntityRelationship(sourceRecordId, request));
        verify(entityRelationshipRepository, never()).save(any());
    }

    @Test
    void testRelationPickerAttribute_ValidatesReferencedRecord() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        AttributeDefinition relationAttr = new AttributeDefinition();
        relationAttr.setSystemName("manager_id");
        relationAttr.setDataType("string");
        relationAttr.setUiComponent("relation_picker");
        relationAttr.setOptions(Map.of("targetEntityTypeId", 2L));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId))
                .thenReturn(List.of(relationAttr));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(2L, 999L))
                .thenReturn(Optional.empty());

        CreateRecordRequest request = new CreateRecordRequest(Map.of("manager_id", 999L), "t-1");

        assertThrows(MetadataNotFoundException.class, () -> metadataService.createEntityRecord(typeId, request));
        verify(entityRecordRepository, never()).save(any());
    }

    @Test
    void testValidateEntityRecordDryRun_Success() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);
        type.setSchemaVersion(3L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId)).thenReturn(List.of());
        when(schemaValidationService.validatePayloadDryRun(eq(typeId), anyMap())).thenReturn(List.of());

        CreateRecordRequest request = new CreateRecordRequest(Map.of("tier", "Enterprise"), "apac-prod");
        ValidateRecordResponse response = metadataService.validateEntityRecordDryRun(typeId, request);

        assertTrue(response.valid());
        assertEquals(3L, response.schemaVersion());
        assertTrue(response.errors().isEmpty());
    }

    @Test
    void testValidateEntityRecordDryRun_Failure() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);
        type.setSchemaVersion(3L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId)).thenReturn(List.of());
        when(schemaValidationService.validatePayloadDryRun(eq(typeId), anyMap())).thenReturn(List.of(
                com.acc.core.io.Error.builder().code("REQUIRED_FIELD").detail("tier").message("tier is required").build()
        ));

        CreateRecordRequest request = new CreateRecordRequest(Map.of(), "apac-prod");
        ValidateRecordResponse response = metadataService.validateEntityRecordDryRun(typeId, request);

        assertFalse(response.valid());
        assertEquals(1, response.errors().size());
        assertEquals("tier", response.errors().get(0).field());
        assertEquals("REQUIRED_FIELD", response.errors().get(0).code());
    }

    @Test
    void testAnalyzeSchemaDrift() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);
        type.setSchemaVersion(3L);

        EntityRecord r1 = new EntityRecord();
        r1.setId(10L);
        r1.setSchemaVersion(3L);

        EntityRecord r2 = new EntityRecord();
        r2.setId(20L);
        r2.setSchemaVersion(1L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId)).thenReturn(List.of(r1, r2));

        SchemaDriftAnalysisResponse analysis = metadataService.analyzeSchemaDrift(typeId);

        assertEquals(typeId, analysis.entityTypeId());
        assertEquals(3L, analysis.currentSchemaVersion());
        assertEquals(2L, analysis.totalRecords());
        assertEquals(1L, analysis.outdatedRecords());
        assertEquals(1L, analysis.compliantRecords());
    }

    @Test
    void testExecuteSchemaBackfill_MigratesOutdatedRecords() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);
        type.setSchemaVersion(3L);

        EntityRecord outdatedRecord = new EntityRecord();
        outdatedRecord.setId(20L);
        outdatedRecord.setSchemaVersion(1L);
        outdatedRecord.setAttributes(new HashMap<>());

        AttributeDefinition attrWithDefault = new AttributeDefinition();
        attrWithDefault.setSystemName("cluster");
        attrWithDefault.setDataType("string");
        attrWithDefault.setDefaultValue("primary");

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(entityRecordRepository.findByEntityTypeIdAndSchemaVersionLessThanAndDeletedDateIsNull(eq(typeId), eq(3L), any()))
                .thenReturn(new org.springframework.data.domain.PageImpl<>(List.of(outdatedRecord)));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId))
                .thenReturn(List.of(attrWithDefault));

        SchemaBackfillExecutionResponse backfill = metadataService.executeSchemaBackfill(typeId, 50);

        assertEquals(1, backfill.processedRecords());
        assertEquals(1, backfill.migratedRecords());
        assertEquals(0, backfill.failedRecords());
        assertEquals(3L, outdatedRecord.getSchemaVersion());
        assertEquals("primary", outdatedRecord.getAttributes().get("cluster"));
        verify(entityRecordRepository).save(outdatedRecord);
    }

    @Test
    void testTransitionRecordState_Success() {
        Long typeId = 1L;
        Long recordId = 100L;
        EntityType type = new EntityType();
        type.setId(typeId);
        type.setSystemName("incident");

        EntityRecord record = new EntityRecord();
        record.setId(recordId);
        record.setEntityType(type);
        record.setTenantId("tenant-alpha");
        record.setAttributes(new HashMap<>(Map.of("status", "OPEN", "priority", "HIGH")));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(typeId, recordId)).thenReturn(Optional.of(record));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(inv -> inv.getArgument(0));

        com.acc.service.workflow.EntityLifecycleService mockLifecycle = mock(com.acc.service.workflow.EntityLifecycleService.class);
        metadataService.setEntityLifecycleService(mockLifecycle);

        EntityRecordResponse response = metadataService.transitionRecordState(typeId, recordId, "RESOLVE", Map.of("resolution", "Fixed"));

        assertNotNull(response);
        verify(mockLifecycle).validateAndExecuteTransition(eq(record), eq("RESOLVE"), anyMap());
        verify(entityRecordRepository).save(record);
        verify(schemaValidationService).validatePayload(eq(typeId), anyMap());
    }

    @Test
    void testValidateEntityRecordDryRun_WithRelationPickerAndSchemaErrors() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);
        type.setSchemaVersion(2L);

        AttributeDefinition relAttr = new AttributeDefinition();
        relAttr.setSystemName("customer_id");
        relAttr.setUiComponent("relation_picker");
        relAttr.setOptions(Map.of("targetEntityTypeId", 2L));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId)).thenReturn(List.of(relAttr));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(2L, 999L)).thenReturn(Optional.empty());

        com.acc.core.io.Error<String> schemaErr = new com.acc.core.io.Error<>();
        schemaErr.setMessage("name is required");
        schemaErr.setCode("REQUIRED_FIELD");
        schemaErr.setDetail("name");
        when(schemaValidationService.validatePayloadDryRun(eq(typeId), anyMap())).thenReturn(List.of(schemaErr));

        CreateRecordRequest req = new CreateRecordRequest(Map.of("customer_id", 999L), "tenant-corp");
        ValidateRecordResponse response = metadataService.validateEntityRecordDryRun(typeId, req);

        assertFalse(response.valid());
        assertEquals(2, response.errors().size());
    }

    @Test
    void testAnalyzeSchemaDrift_Success() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);
        type.setSchemaVersion(3L);

        EntityRecord r1 = new EntityRecord();
        r1.setSchemaVersion(3L);
        EntityRecord r2 = new EntityRecord();
        r2.setSchemaVersion(2L);
        EntityRecord r3 = new EntityRecord();
        r3.setSchemaVersion(null);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(entityRecordRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId)).thenReturn(List.of(r1, r2, r3));

        SchemaDriftAnalysisResponse response = metadataService.analyzeSchemaDrift(typeId);

        assertEquals(3L, response.currentSchemaVersion());
        assertEquals(3L, response.totalRecords());
        assertEquals(2L, response.outdatedRecords());
        assertEquals(1L, response.compliantRecords());
    }

    @Test
    void testIsDangerousRegex() {
        assertTrue(MetadataService.isDangerousRegex("(a+)+"));
        assertTrue(MetadataService.isDangerousRegex("([a-z]+)*"));
        assertFalse(MetadataService.isDangerousRegex("^[a-zA-Z0-9_-]+$"));
        assertFalse(MetadataService.isDangerousRegex(null));
    }

    @Test
    void testPipelineDelegation_AuditLogs_PreviewRestore_Restore() {
        RecordMutationPipeline mockPipeline = mock(RecordMutationPipeline.class);
        metadataService.setRecordMutationPipeline(mockPipeline);

        metadataService.getRecordAuditLogs(1L, 10L);
        verify(mockPipeline).getRecordAuditLogs(1L, 10L);

        metadataService.previewRestoreRecordVersion(1L, 10L, 100L);
        verify(mockPipeline).previewRestore(1L, 10L, 100L);

        metadataService.restoreRecordToAuditVersion(1L, 10L, 100L);
        verify(mockPipeline).executeRestore(1L, 10L, 100L);
    }

    @Test
    void testGetEntityRecords_WithSortAndFilters() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(typeId)).thenReturn(Collections.emptyList());

        org.springframework.data.domain.Page<EntityRecord> springPage = new org.springframework.data.domain.PageImpl<>(Collections.emptyList());
        when(entityRecordRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(springPage);
        when(pageBuilder.build(any(), any(), any())).thenReturn(customPageMock);

        PageRequest req = new PageRequest();
        req.setNumber(1);
        req.setSize(10);

        Page<EntityRecordResponse> result = metadataService.getEntityRecords(
                typeId, req, Map.of("name", Map.of("eq", "test")), "createdDate", "desc", "tenant-alpha"
        );

        assertNotNull(result);
        verify(entityRecordRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), any(org.springframework.data.domain.Pageable.class));
    }

    @Test
    void testSeekEntityRecords_Success() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        EntityRecord r1 = new EntityRecord();
        r1.setId(10L);
        r1.setEntityType(type);
        r1.setTenantId("tenant-alpha");
        r1.setAttributes(Map.of("name", "Item 10"));

        EntityRecord r2 = new EntityRecord();
        r2.setId(20L);
        r2.setEntityType(type);
        r2.setTenantId("tenant-alpha");
        r2.setAttributes(Map.of("name", "Item 20"));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(entityRecordRepository.seekRecords(eq(typeId), eq("tenant-alpha"), eq(null), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(List.of(r1, r2));

        SeekPageResponse<EntityRecordResponse> response = metadataService.seekEntityRecords(typeId, null, 10, "tenant-alpha");

        assertNotNull(response);
        assertEquals(2, response.items().size());
        assertFalse(response.hasMore());
        assertNull(response.nextCursor());
    }

    @Test
    void testGetAttributeDefinitionsAndGetAttributeDefinition() {
        Long typeId = 1L;
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(new EntityType()));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNullOrderByDisplayOrderAsc(eq(typeId), any())).thenReturn(springPageMock);
        when(pageBuilder.build(eq(defaultPageRequest), any(), any())).thenReturn(customPageMock);

        Page<AttributeDefinitionResponse> page = metadataService.getAttributeDefinitions(typeId, defaultPageRequest);
        assertNotNull(page);

        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(10L);
        attr.setName("Title");
        attr.setSystemName("title");
        attr.setDataType("string");
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(typeId, 10L)).thenReturn(Optional.of(attr));

        AttributeDefinitionResponse res = metadataService.getAttributeDefinition(typeId, 10L);
        assertNotNull(res);
        assertEquals("Title", res.name());
    }

    @Test
    void testRelationshipTypeLifecycle_ListGetUpdateDelete() {
        when(relationshipTypeRepository.findAllByDeletedDateIsNull(any())).thenReturn(springPageMock);
        when(pageBuilder.build(eq(defaultPageRequest), any(), any())).thenReturn(customPageMock);

        Page<RelationshipTypeResponse> page = metadataService.getRelationshipTypes(defaultPageRequest);
        assertNotNull(page);

        RelationshipType rel = new RelationshipType();
        rel.setId(5L);
        rel.setSystemName("author_of");
        rel.setDescription("Author Of");
        rel.setVersion(1L);
        when(relationshipTypeRepository.findByIdAndDeletedDateIsNull(5L)).thenReturn(Optional.of(rel));

        RelationshipTypeResponse res = metadataService.getRelationshipType(5L);
        assertNotNull(res);
        assertEquals("author_of", res.systemName());

        // Update
        when(relationshipTypeRepository.save(any(RelationshipType.class))).thenAnswer(inv -> inv.getArgument(0));
        UpdateRelationshipTypeRequest updateReq = new UpdateRelationshipTypeRequest("New Desc", null, null, "ONE_TO_MANY", 1L);
        RelationshipTypeResponse updated = metadataService.updateRelationshipType(5L, updateReq);
        assertEquals("New Desc", updated.description());

        // Update with OCC mismatch throws conflict
        UpdateRelationshipTypeRequest mismatchReq = new UpdateRelationshipTypeRequest("New Desc", null, null, "ONE_TO_MANY", 99L);
        assertThrows(MetadataConflictException.class, () -> metadataService.updateRelationshipType(5L, mismatchReq));

        // Delete with force=false and existing relations throws conflict
        when(entityRelationshipRepository.existsByRelationshipTypeIdAndDeletedDateIsNull(5L)).thenReturn(true);
        assertThrows(MetadataConflictException.class, () -> metadataService.deleteRelationshipType(5L, false));

        // Delete with force=true succeeds
        metadataService.deleteRelationshipType(5L, true);
        assertNotNull(rel.getDeletedDate());
        verify(relationshipTypeRepository, atLeastOnce()).save(rel);
    }

    @Test
    void testRecordRelationshipsLifecycle_GetAndDelete() {
        Long recordId = 100L;
        EntityRecord record = new EntityRecord();
        record.setId(recordId);
        when(entityRecordRepository.findByIdAndDeletedDateIsNull(recordId)).thenReturn(Optional.of(record));

        when(entityRelationshipRepository.findBySourceEntityIdAndDeletedDateIsNull(eq(recordId), any())).thenReturn(springPageMock);
        when(pageBuilder.build(eq(defaultPageRequest), any(), any())).thenReturn(customPageMock);

        Page<EntityRelationshipResponse> pageOut = metadataService.getRecordRelationships(recordId, "outgoing", defaultPageRequest);
        assertNotNull(pageOut);

        when(entityRelationshipRepository.findByTargetEntityIdAndDeletedDateIsNull(eq(recordId), any())).thenReturn(springPageMock);
        Page<EntityRelationshipResponse> pageIn = metadataService.getRecordRelationships(recordId, "incoming", defaultPageRequest);
        assertNotNull(pageIn);

        when(entityRelationshipRepository.findBySourceEntityIdOrTargetEntityIdAndDeletedDateIsNull(eq(recordId), eq(recordId), any())).thenReturn(springPageMock);
        Page<EntityRelationshipResponse> pageBoth = metadataService.getRecordRelationships(recordId, "both", defaultPageRequest);
        assertNotNull(pageBoth);

        // Delete relationship
        EntityRelationship edge = new EntityRelationship();
        edge.setId(50L);
        edge.setSourceEntity(record);
        when(entityRelationshipRepository.findByIdAndDeletedDateIsNull(50L)).thenReturn(Optional.of(edge));

        metadataService.deleteEntityRelationship(recordId, 50L);
        assertNotNull(edge.getDeletedDate());
        verify(entityRelationshipRepository).save(edge);
    }

    @Test
    void testValidateUiComponentCompatibility_ThrowsOnIncompatible() {
        Long typeId = 1L;
        EntityType type = new EntityType();
        type.setId(typeId);

        AttributeDefinition attr = new AttributeDefinition();
        attr.setId(10L);
        attr.setDataType("number");
        attr.setUiComponent("number");
        attr.setVersion(1L);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(typeId, 10L)).thenReturn(Optional.of(attr));

        UpdateAttributeRequest incompatibleReq = new UpdateAttributeRequest("Score", "textarea", false, false, 1, null, null, 1L);
        assertThrows(MetadataConflictException.class, () -> metadataService.updateAttributeDefinition(typeId, 10L, incompatibleReq));
    }

    @Test
    void testGetEntityRecord_Success() {
        Long typeId = 1L;
        Long recordId = 200L;
        EntityType type = new EntityType();
        type.setId(typeId);
        EntityRecord record = new EntityRecord();
        record.setId(recordId);
        record.setEntityType(type);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(typeId)).thenReturn(Optional.of(type));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(typeId, recordId)).thenReturn(Optional.of(record));

        EntityRecordResponse res = metadataService.getEntityRecord(typeId, recordId);
        assertNotNull(res);
        assertEquals(200L, res.id());
    }

    @Test
    void testMetadataNotFound_AllEntitiesAndMethods() {
        Long missingId = 999L;
        lenient().when(entityTypeRepository.findAllByDeletedDateIsNull()).thenReturn(Collections.emptyList());
        lenient().when(entityTypeRepository.findByIdAndDeletedDateIsNull(missingId)).thenReturn(Optional.empty());
        lenient().when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(eq(missingId), anyLong())).thenReturn(Optional.empty());
        lenient().when(relationshipTypeRepository.findByIdAndDeletedDateIsNull(missingId)).thenReturn(Optional.empty());
        lenient().when(entityRecordRepository.findByIdAndDeletedDateIsNull(missingId)).thenReturn(Optional.empty());

        assertThrows(MetadataNotFoundException.class, () -> metadataService.getEntityType(missingId));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.updateEntityType(missingId, new UpdateEntityTypeRequest("X", null, 1L)));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.deleteEntityType(missingId));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.getCompiledSchema(missingId));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.getAttributeDefinitions(missingId, defaultPageRequest));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.getAttributeDefinition(missingId, 10L));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.createAttributeDefinition(missingId, new CreateAttributeRequest("S", "N", "string", "text", false, false, null, null)));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.updateAttributeDefinition(missingId, 10L, new UpdateAttributeRequest("N", null, false, false, 1, null, null, 1L)));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.deleteAttributeDefinition(missingId, 10L, false));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.archiveAttributeDefinition(missingId, 10L));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.unarchiveAttributeDefinition(missingId, 10L));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.reorderAttributes(missingId, new ReorderAttributesRequest(List.of(1L))));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.getEntityRecords(missingId, defaultPageRequest));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.getEntityRecord(missingId, 10L));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.transitionRecordState(missingId, 10L, "SUBMIT", Map.of()));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.analyzeSchemaDrift(missingId));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.executeSchemaBackfill(missingId, 100));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.getRelationshipType(missingId));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.updateRelationshipType(missingId, new UpdateRelationshipTypeRequest("Desc", null, null, "ONE_TO_MANY", 1L)));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.deleteRelationshipType(missingId, false));
        assertThrows(MetadataNotFoundException.class, () -> metadataService.getRecordRelationships(missingId, "outgoing", defaultPageRequest));
    }

    @Test
    void testCreateEntityRelationship_AllConflictBranches() {
        Long sourceId = 101L;
        Long targetId = 202L;
        Long relTypeId = 303L;

        CreateEntityRelationshipRequest req = new CreateEntityRelationshipRequest(targetId, relTypeId, Map.of("role", "reviewer"));

        // Source missing
        when(entityRecordRepository.findByIdAndDeletedDateIsNull(sourceId)).thenReturn(Optional.empty());
        assertThrows(MetadataNotFoundException.class, () -> metadataService.createEntityRelationship(sourceId, req));

        // Target missing
        EntityRecord source = new EntityRecord();
        source.setId(sourceId);
        source.setTenantId("tenant-alpha");
        EntityType srcType = new EntityType();
        srcType.setId(1L);
        source.setEntityType(srcType);
        when(entityRecordRepository.findByIdAndDeletedDateIsNull(sourceId)).thenReturn(Optional.of(source));
        when(entityRecordRepository.findByIdAndDeletedDateIsNull(targetId)).thenReturn(Optional.empty());
        assertThrows(MetadataNotFoundException.class, () -> metadataService.createEntityRelationship(sourceId, req));

        // RelType missing
        EntityRecord target = new EntityRecord();
        target.setId(targetId);
        target.setTenantId("tenant-alpha");
        EntityType tgtType = new EntityType();
        tgtType.setId(2L);
        target.setEntityType(tgtType);
        when(entityRecordRepository.findByIdAndDeletedDateIsNull(targetId)).thenReturn(Optional.of(target));
        when(relationshipTypeRepository.findByIdAndDeletedDateIsNull(relTypeId)).thenReturn(Optional.empty());
        assertThrows(MetadataNotFoundException.class, () -> metadataService.createEntityRelationship(sourceId, req));

        // Cross tenant mismatch
        RelationshipType relType = new RelationshipType();
        relType.setId(relTypeId);
        relType.setSystemName("authored_by");
        when(relationshipTypeRepository.findByIdAndDeletedDateIsNull(relTypeId)).thenReturn(Optional.of(relType));
        target.setTenantId("tenant-beta");
        assertThrows(MetadataConflictException.class, () -> metadataService.createEntityRelationship(sourceId, req));
        target.setTenantId("tenant-alpha");

        // Source entity type mismatch
        EntityType requiredSourceType = new EntityType();
        requiredSourceType.setId(99L);
        relType.setSourceEntityType(requiredSourceType);
        assertThrows(MetadataConflictException.class, () -> metadataService.createEntityRelationship(sourceId, req));
        relType.setSourceEntityType(srcType);

        // Target entity type mismatch
        EntityType requiredTargetType = new EntityType();
        requiredTargetType.setId(98L);
        relType.setTargetEntityType(requiredTargetType);
        assertThrows(MetadataConflictException.class, () -> metadataService.createEntityRelationship(sourceId, req));
        relType.setTargetEntityType(tgtType);

        // Triplet duplicate
        when(entityRelationshipRepository.existsBySourceEntityIdAndTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(sourceId, targetId, relTypeId))
                .thenReturn(true);
        assertThrows(MetadataConflictException.class, () -> metadataService.createEntityRelationship(sourceId, req));
        when(entityRelationshipRepository.existsBySourceEntityIdAndTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(sourceId, targetId, relTypeId))
                .thenReturn(false);

        // Cardinality ONE_TO_ONE incoming count > 0
        relType.setCardinality("ONE_TO_ONE");
        when(entityRelationshipRepository.countByTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(targetId, relTypeId)).thenReturn(1L);
        assertThrows(MetadataConflictException.class, () -> metadataService.createEntityRelationship(sourceId, req));
        when(entityRelationshipRepository.countByTargetEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(targetId, relTypeId)).thenReturn(0L);

        // Cardinality ONE_TO_ONE outgoing count > 0
        when(entityRelationshipRepository.countBySourceEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(sourceId, relTypeId)).thenReturn(1L);
        assertThrows(MetadataConflictException.class, () -> metadataService.createEntityRelationship(sourceId, req));
        when(entityRelationshipRepository.countBySourceEntityIdAndRelationshipTypeIdAndDeletedDateIsNull(sourceId, relTypeId)).thenReturn(0L);

        // Success
        when(entityRelationshipRepository.save(any(EntityRelationship.class))).thenAnswer(inv -> {
            EntityRelationship r = inv.getArgument(0);
            r.setId(555L);
            return r;
        });
        EntityRelationshipResponse res = metadataService.createEntityRelationship(sourceId, req);
        assertNotNull(res);
        assertEquals(555L, res.id());
    }

    @Test
    void testDeleteEntityRelationship_NotConnectedThrowsConflict() {
        Long sourceId = 100L;
        Long edgeId = 50L;

        when(entityRecordRepository.findByIdAndDeletedDateIsNull(sourceId)).thenReturn(Optional.of(new EntityRecord()));

        EntityRelationship edge = new EntityRelationship();
        edge.setId(edgeId);
        EntityRecord other1 = new EntityRecord();
        other1.setId(888L);
        EntityRecord other2 = new EntityRecord();
        other2.setId(999L);
        edge.setSourceEntity(other1);
        edge.setTargetEntity(other2);

        when(entityRelationshipRepository.findByIdAndDeletedDateIsNull(edgeId)).thenReturn(Optional.of(edge));
        assertThrows(MetadataConflictException.class, () -> metadataService.deleteEntityRelationship(sourceId, edgeId));
    }

    @Test
    void testCompositeDependencyGuards_AttributeAndEntityType() {
        EntityType compositeType = new EntityType();
        compositeType.setId(50L);
        compositeType.setName("Composite Order");
        compositeType.setIsComposite(true);

        com.acc.domain.metadata.CompositeField field = new com.acc.domain.metadata.CompositeField("sku", "itemSku", "string", null, false);
        com.acc.domain.metadata.CompositeNode child = new com.acc.domain.metadata.CompositeNode(
                2L, "items", "items", com.acc.domain.metadata.CompositeJoinPattern.PATTERN_B_FOREIGN_KEY,
                "orderId", null, "ONE_TO_MANY", List.of(field), null
        );
        com.acc.domain.metadata.CompositeSpec spec = new com.acc.domain.metadata.CompositeSpec(
                1L, "orders", "Order composite",
                List.of(new com.acc.domain.metadata.CompositeField("orderNumber", "orderNum", "string", null, false)),
                List.of(child)
        );
        compositeType.setCompositeSpec(spec);

        when(entityTypeRepository.findAllByDeletedDateIsNull()).thenReturn(List.of(compositeType));

        // EntityType 1L has composite dependency on root
        assertThrows(MetadataConflictException.class, () -> metadataService.deleteEntityType(1L));

        // EntityType 2L has composite dependency on child node
        assertThrows(MetadataConflictException.class, () -> metadataService.deleteEntityType(2L));

        // Attribute "orderNumber" on entityType 1L
        EntityType entityType1 = new EntityType();
        entityType1.setId(1L);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(entityType1));
        AttributeDefinition attr1 = new AttributeDefinition();
        attr1.setId(10L);
        attr1.setSystemName("orderNumber");
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(1L, 10L)).thenReturn(Optional.of(attr1));
        assertThrows(MetadataConflictException.class, () -> metadataService.deleteAttributeDefinition(1L, 10L, false));

        // Attribute "sku" on entityType 2L (child field)
        EntityType entityType2 = new EntityType();
        entityType2.setId(2L);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(2L)).thenReturn(Optional.of(entityType2));
        AttributeDefinition attr2 = new AttributeDefinition();
        attr2.setId(20L);
        attr2.setSystemName("sku");
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(2L, 20L)).thenReturn(Optional.of(attr2));
        assertThrows(MetadataConflictException.class, () -> metadataService.archiveAttributeDefinition(2L, 20L));

        // Attribute "orderId" on entityType 2L (foreignKeyAttribute)
        AttributeDefinition attrFk = new AttributeDefinition();
        attrFk.setId(21L);
        attrFk.setSystemName("orderId");
        when(attributeDefinitionRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(2L, 21L)).thenReturn(Optional.of(attrFk));
        assertThrows(MetadataConflictException.class, () -> metadataService.deleteAttributeDefinition(2L, 21L, true));
    }

    @Test
    void testTransitionRecordState_ThrowsOnCompositeEntityType() {
        EntityType composite = new EntityType();
        composite.setId(1L);
        composite.setIsComposite(true);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(1L)).thenReturn(Optional.of(composite));

        assertThrows(UnsupportedOperationException.class, () -> metadataService.transitionRecordState(1L, 100L, "SUBMIT", null));
    }

    @Test
    void testSeekEntityRecords_FirstPage_Success() {
        Long entityTypeId = 1L;
        EntityType entityType = new EntityType();
        entityType.setId(entityTypeId);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)).thenReturn(Optional.of(entityType));

        EntityRecord r1 = new EntityRecord();
        r1.setId(10L);
        r1.setEntityType(entityType);
        r1.setTenantId("tenant-1");
        r1.setAttributes(Map.of("name", "Item 1"));

        EntityRecord r2 = new EntityRecord();
        r2.setId(20L);
        r2.setEntityType(entityType);
        r2.setTenantId("tenant-1");
        r2.setAttributes(Map.of("name", "Item 2"));

        EntityRecord r3 = new EntityRecord();
        r3.setId(30L);
        r3.setEntityType(entityType);
        r3.setTenantId("tenant-1");
        r3.setAttributes(Map.of("name", "Item 3"));

        when(entityRecordRepository.seekRecords(eq(entityTypeId), eq("tenant-1"), isNull(), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(List.of(r1, r2, r3));

        com.acc.presentation.dto.metadata.SeekPageResponse<EntityRecordResponse> response =
                metadataService.seekEntityRecords(entityTypeId, null, 2, "tenant-1");

        assertNotNull(response);
        assertEquals(2, response.items().size());
        assertTrue(response.hasMore());
        assertNotNull(response.nextCursor());
        String decodedCursor = new String(java.util.Base64.getDecoder().decode(response.nextCursor()), java.nio.charset.StandardCharsets.UTF_8);
        assertEquals("20", decodedCursor);
    }

    @Test
    void testSeekEntityRecords_WithCursor_Success() {
        Long entityTypeId = 1L;
        EntityType entityType = new EntityType();
        entityType.setId(entityTypeId);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)).thenReturn(Optional.of(entityType));

        String cursor = java.util.Base64.getEncoder().encodeToString("20".getBytes(java.nio.charset.StandardCharsets.UTF_8));

        EntityRecord r3 = new EntityRecord();
        r3.setId(30L);
        r3.setEntityType(entityType);
        r3.setTenantId("tenant-1");
        r3.setAttributes(Map.of("name", "Item 3"));

        when(entityRecordRepository.seekRecords(eq(entityTypeId), eq("tenant-1"), eq(20L), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(List.of(r3));

        com.acc.presentation.dto.metadata.SeekPageResponse<EntityRecordResponse> response =
                metadataService.seekEntityRecords(entityTypeId, cursor, 2, "tenant-1");

        assertNotNull(response);
        assertEquals(1, response.items().size());
        assertFalse(response.hasMore());
        assertNull(response.nextCursor());
    }

    @Test
    void testSeekEntityRecords_WithTimestampPrefixedCursor_ExtractsId() {
        Long entityTypeId = 1L;
        EntityType entityType = new EntityType();
        entityType.setId(entityTypeId);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)).thenReturn(Optional.of(entityType));

        String rawCursor = "2026-10-20T12:00:00Z:55";
        String cursor = java.util.Base64.getEncoder().encodeToString(rawCursor.getBytes(java.nio.charset.StandardCharsets.UTF_8));

        EntityRecord r = new EntityRecord();
        r.setId(60L);
        r.setEntityType(entityType);
        r.setTenantId("tenant-1");

        when(entityRecordRepository.seekRecords(eq(entityTypeId), eq("tenant-1"), eq(55L), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(List.of(r));

        com.acc.presentation.dto.metadata.SeekPageResponse<EntityRecordResponse> response =
                metadataService.seekEntityRecords(entityTypeId, cursor, 10, "tenant-1");

        assertNotNull(response);
        assertEquals(1, response.items().size());
        verify(entityRecordRepository).seekRecords(eq(entityTypeId), eq("tenant-1"), eq(55L), any(org.springframework.data.domain.Pageable.class));
    }

    @Test
    void testSeekEntityRecords_MalformedCursor_FallsBackToNullAfterId() {
        Long entityTypeId = 1L;
        EntityType entityType = new EntityType();
        entityType.setId(entityTypeId);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(entityTypeId)).thenReturn(Optional.of(entityType));

        when(entityRecordRepository.seekRecords(eq(entityTypeId), eq("tenant-1"), isNull(), any(org.springframework.data.domain.Pageable.class)))
                .thenReturn(Collections.emptyList());

        com.acc.presentation.dto.metadata.SeekPageResponse<EntityRecordResponse> response =
                metadataService.seekEntityRecords(entityTypeId, "not-valid-base-64!!", 10, "tenant-1");

        assertNotNull(response);
        assertTrue(response.items().isEmpty());
        assertFalse(response.hasMore());
        verify(entityRecordRepository).seekRecords(eq(entityTypeId), eq("tenant-1"), isNull(), any(org.springframework.data.domain.Pageable.class));
    }

    @Test
    void testSeekEntityRecords_EntityTypeNotFound_Throws() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(999L)).thenReturn(Optional.empty());

        assertThrows(MetadataNotFoundException.class, () ->
                metadataService.seekEntityRecords(999L, null, 10, "tenant-1"));
    }
}


