package com.acc.service;

import com.acc.domain.metadata.*;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.outbox.OutboxEventPublisher;
import com.acc.presentation.dto.metadata.*;
import com.acc.repository.jpa.*;
import com.acc.service.exception.MetadataConflictException;
import com.acc.service.exception.MetadataNotFoundException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.LocalDateTime;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class RecordMutationPipelineTest {

    @Mock
    private EntityTypeRepository entityTypeRepository;
    @Mock
    private EntityRecordRepository entityRecordRepository;
    @Mock
    private AttributeDefinitionRepository attributeDefinitionRepository;
    @Mock
    private RelationshipTypeRepository relationshipTypeRepository;
    @Mock
    private EntityRelationshipRepository entityRelationshipRepository;
    @Mock
    private RecordAuditLogRepository recordAuditLogRepository;
    @Mock
    private SchemaValidationService schemaValidationService;
    @Mock
    private JdbcTemplate jdbcTemplate;
    @Mock
    private OutboxEventPublisher outboxEventPublisher;

    private RecordMutationPipeline pipeline;

    private EntityType customerType;
    private EntityType orderType;
    private AttributeDefinition customerTierAttr;
    private AttributeDefinition orderCustomerRefAttr;

    @BeforeEach
    void setUp() {
        TenantContextHolder.setTenantId("tenant-corp");

        pipeline = new RecordMutationPipeline(
                entityTypeRepository,
                entityRecordRepository,
                attributeDefinitionRepository,
                relationshipTypeRepository,
                entityRelationshipRepository,
                recordAuditLogRepository,
                schemaValidationService,
                jdbcTemplate
        );
        pipeline.setOutboxEventPublisher(outboxEventPublisher);

        customerType = new EntityType();
        customerType.setId(10L);
        customerType.setName("Customer");
        customerType.setSystemName("customer");
        customerType.setSchemaVersion(1L);
        customerType.setIsComposite(false);

        orderType = new EntityType();
        orderType.setId(20L);
        orderType.setName("Order");
        orderType.setSystemName("order");
        orderType.setSchemaVersion(1L);
        orderType.setIsComposite(false);

        customerTierAttr = new AttributeDefinition();
        customerTierAttr.setId(101L);
        customerTierAttr.setEntityType(customerType);
        customerTierAttr.setName("Tier");
        customerTierAttr.setSystemName("tier");
        customerTierAttr.setDataType("string");
        customerTierAttr.setUiComponent("text");
        customerTierAttr.setDefaultValue("STANDARD");
        customerTierAttr.setIsArchived(false);

        orderCustomerRefAttr = new AttributeDefinition();
        orderCustomerRefAttr.setId(201L);
        orderCustomerRefAttr.setEntityType(orderType);
        orderCustomerRefAttr.setName("Customer Reference");
        orderCustomerRefAttr.setSystemName("customer_id");
        orderCustomerRefAttr.setDataType("long");
        orderCustomerRefAttr.setUiComponent("relation_picker");
        orderCustomerRefAttr.setOptions(Map.of("targetEntityTypeId", 10L, "cascadePolicy", "RESTRICT"));
        orderCustomerRefAttr.setIsArchived(false);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
    }

    @Test
    void testCreateRecord_EnforcesDefaultsAndCreatesAuditLog() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(10L)).thenReturn(List.of(customerTierAttr));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(invocation -> {
            EntityRecord r = invocation.getArgument(0);
            r.setId(1001L);
            return r;
        });

        CreateRecordRequest request = new CreateRecordRequest(Map.of("name", "Acme Logistics"), "tenant-corp");
        EntityRecordResponse response = pipeline.executeCreate(10L, request);

        assertThat(response.id()).isEqualTo(1001L);
        assertThat(response.attributes()).containsEntry("name", "Acme Logistics");
        assertThat(response.attributes()).containsEntry("tier", "STANDARD"); // Default applied

        ArgumentCaptor<RecordAuditLog> auditCaptor = ArgumentCaptor.forClass(RecordAuditLog.class);
        verify(recordAuditLogRepository).save(auditCaptor.capture());
        RecordAuditLog savedAudit = auditCaptor.getValue();
        assertThat(savedAudit.getOperation()).isEqualTo("CREATE");
        assertThat(savedAudit.getRecordId()).isEqualTo(1001L);
        assertThat(savedAudit.getNewAttributes()).containsEntry("tier", "STANDARD");
        assertThat(savedAudit.getOldAttributes()).isNull();

        verify(outboxEventPublisher).publish(eq("entity_record"), eq("1001"), eq("RECORD_CREATED"), eq("tenant-corp"), any());
    }

    @Test
    void testUpdateRecord_WithValidIfMatch_SucceedsAndComputesDelta() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(10L)).thenReturn(List.of(customerTierAttr));

        EntityRecord existing = new EntityRecord();
        existing.setId(1001L);
        existing.setEntityType(customerType);
        existing.setTenantId("tenant-corp");
        existing.setVersion(1L);
        existing.setAttributes(new HashMap<>(Map.of("name", "Acme", "tier", "STANDARD")));

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(existing));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UpdateRecordRequest updateReq = new UpdateRecordRequest(Map.of("name", "Acme Corp", "tier", "VIP"), null, null);
        EntityRecordResponse response = pipeline.executeUpdate(10L, 1001L, updateReq, "\"1\"");

        assertThat(response.version()).isEqualTo(2L);
        assertThat(response.attributes()).containsEntry("name", "Acme Corp");
        assertThat(response.attributes()).containsEntry("tier", "VIP");

        ArgumentCaptor<RecordAuditLog> auditCaptor = ArgumentCaptor.forClass(RecordAuditLog.class);
        verify(recordAuditLogRepository).save(auditCaptor.capture());
        RecordAuditLog audit = auditCaptor.getValue();
        assertThat(audit.getOperation()).isEqualTo("UPDATE");
        assertThat(audit.getVersion()).isEqualTo(2L);
        assertThat(audit.getDelta()).isNotNull();
        assertThat(audit.getDelta()).containsKey("name");
        assertThat(audit.getDelta()).containsKey("tier");
    }

    @Test
    void testUpdateRecord_WithVersionMismatchAndBaseAttributes_Performs3WayMerge() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(10L)).thenReturn(List.of());

        EntityRecord existing = new EntityRecord();
        existing.setId(1001L);
        existing.setEntityType(customerType);
        existing.setTenantId("tenant-corp");
        existing.setVersion(2L); // DB has version 2
        existing.setAttributes(new HashMap<>(Map.of("name", "Acme", "tier", "GOLD")));

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(existing));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Client read version 1 (name: Acme, tier: STANDARD), and updated name to Acme Corp
        Map<String, Object> baseAttrs = Map.of("name", "Acme", "tier", "STANDARD");
        Map<String, Object> incomingAttrs = Map.of("name", "Acme Corp", "tier", "STANDARD");

        UpdateRecordRequest updateReq = new UpdateRecordRequest(incomingAttrs, 1L, baseAttrs);
        EntityRecordResponse response = pipeline.executeUpdate(10L, 1001L, updateReq, null);

        // Merged result: name from client (Acme Corp), tier from server (GOLD)
        assertThat(response.attributes()).containsEntry("name", "Acme Corp");
        assertThat(response.attributes()).containsEntry("tier", "GOLD");
    }

    @Test
    void testUpdateRecord_WithVersionMismatchNoBase_ThrowsConflict409() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));

        EntityRecord existing = new EntityRecord();
        existing.setId(1001L);
        existing.setEntityType(customerType);
        existing.setTenantId("tenant-corp");
        existing.setVersion(5L);

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(existing));

        UpdateRecordRequest updateReq = new UpdateRecordRequest(Map.of("name", "New Name"), 4L, null);

        assertThatThrownBy(() -> pipeline.executeUpdate(10L, 1001L, updateReq, "\"4\""))
                .isInstanceOf(MetadataConflictException.class)
                .hasMessageContaining("Optimistic lock conflict");
    }

    @Test
    void testReferentialIntegrity_CrossTenantReference_ThrowsNotFound404() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(20L)).thenReturn(Optional.of(orderType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(20L)).thenReturn(List.of(orderCustomerRefAttr));

        EntityRecord foreignCustomer = new EntityRecord();
        foreignCustomer.setId(999L);
        foreignCustomer.setTenantId("tenant-rival"); // Belongs to different tenant!

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 999L)).thenReturn(Optional.of(foreignCustomer));

        CreateRecordRequest request = new CreateRecordRequest(Map.of("order_no", "ORD-1", "customer_id", 999L), "tenant-corp");

        assertThatThrownBy(() -> pipeline.executeCreate(20L, request))
                .isInstanceOf(MetadataNotFoundException.class)
                .hasMessageContaining("does not exist");
    }

    @Test
    void testDeleteRecord_WithRestrictPolicy_ActiveReferences_ThrowsConflict409() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));

        EntityRecord customer = new EntityRecord();
        customer.setId(1001L);
        customer.setTenantId("tenant-corp");
        customer.setEntityType(customerType);

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(customer));
        when(attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull("tenant-corp")).thenReturn(List.of(orderCustomerRefAttr));

        // 3 orders actively reference customer 1001
        when(jdbcTemplate.queryForObject(any(String.class), eq(Integer.class), eq("tenant-corp"), eq(20L), eq("customer_id"), eq("1001")))
                .thenReturn(3);

        assertThatThrownBy(() -> pipeline.executeDelete(10L, 1001L))
                .isInstanceOf(MetadataConflictException.class)
                .hasMessageContaining("RESTRICT policy");
    }

    @Test
    void testDeleteRecord_WithCascadePolicy_BulkSoftDeletesChildren() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));

        EntityRecord customer = new EntityRecord();
        customer.setId(1001L);
        customer.setTenantId("tenant-corp");
        customer.setEntityType(customerType);

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(customer));

        AttributeDefinition cascadeAttr = new AttributeDefinition();
        cascadeAttr.setEntityType(orderType);
        cascadeAttr.setSystemName("customer_id");
        cascadeAttr.setOptions(Map.of("targetEntityTypeId", 10L, "cascadePolicy", "CASCADE"));
        cascadeAttr.setIsArchived(false);

        when(attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull("tenant-corp")).thenReturn(List.of(cascadeAttr));
        when(jdbcTemplate.queryForObject(any(String.class), eq(Integer.class), eq("tenant-corp"), eq(20L), eq("customer_id"), eq("1001")))
                .thenReturn(2);

        pipeline.executeDelete(10L, 1001L);

        // Bulk soft-delete SQL executed for child orders
        verify(jdbcTemplate).update(
                contains("UPDATE UNIPOST_ENTITIES SET \"deletedDate\" = NOW()"),
                eq("tenant-corp"), eq(20L), eq("customer_id"), eq("1001")
        );

        // Customer itself soft-deleted
        assertThat(customer.getDeletedDate()).isNotNull();

        // Audit log records SOFT_DELETE
        ArgumentCaptor<RecordAuditLog> auditCaptor = ArgumentCaptor.forClass(RecordAuditLog.class);
        verify(recordAuditLogRepository).save(auditCaptor.capture());
        assertThat(auditCaptor.getValue().getOperation()).isEqualTo("SOFT_DELETE");
        assertThat(auditCaptor.getValue().getNewAttributes()).isNull();
    }

    @Test
    void testPreviewRestore_ReturnsDiffWithoutPersisting() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(10L)).thenReturn(List.of(customerTierAttr));

        EntityRecord currentRecord = new EntityRecord();
        currentRecord.setId(1001L);
        currentRecord.setTenantId("tenant-corp");
        currentRecord.setAttributes(Map.of("name", "Acme Current", "notes", "VIP"));

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(currentRecord));

        RecordAuditLog auditLog = RecordAuditLog.builder()
                .id(501L)
                .version(1L)
                .newAttributes(Map.of("name", "Acme Original"))
                .build();

        when(recordAuditLogRepository.findByTenantIdAndEntityTypeIdAndRecordIdAndId("tenant-corp", 10L, 1001L, 501L))
                .thenReturn(Optional.of(auditLog));

        RestorePreviewResponse preview = pipeline.previewRestore(10L, 1001L, 501L);

        assertThat(preview.recordId()).isEqualTo(1001L);
        assertThat(preview.targetVersion()).isEqualTo(1L);
        assertThat(preview.proposedAttributes()).containsEntry("name", "Acme Original");
        assertThat(preview.proposedAttributes()).containsEntry("tier", "STANDARD"); // default applied
        assertThat(preview.removedFields()).contains("notes");

        // Verify no changes saved to DB
        verify(entityRecordRepository, never()).save(any());
        verify(recordAuditLogRepository, never()).save(any());
    }

    @Test
    void testRestoreToAuditVersion_SovereignCustody_SuccessMonotonicVersion() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));
        when(attributeDefinitionRepository.findByEntityTypeIdAndDeletedDateIsNull(10L)).thenReturn(List.of(customerTierAttr));

        EntityRecord currentRecord = new EntityRecord();
        currentRecord.setId(1001L);
        currentRecord.setTenantId("tenant-corp");
        currentRecord.setVersion(5L);
        currentRecord.setAttributes(new HashMap<>(Map.of("name", "Corrupted Name")));

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(currentRecord));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        RecordAuditLog historicalAudit = RecordAuditLog.builder()
                .id(202L)
                .version(2L)
                .newAttributes(Map.of("name", "Primacy Corp"))
                .build();

        when(recordAuditLogRepository.findByTenantIdAndEntityTypeIdAndRecordIdAndId("tenant-corp", 10L, 1001L, 202L))
                .thenReturn(Optional.of(historicalAudit));

        EntityRecordResponse response = pipeline.executeRestore(10L, 1001L, 202L);

        assertThat(response.version()).isEqualTo(6L); // 5L + 1
        assertThat(response.attributes()).containsEntry("name", "Primacy Corp");
        assertThat(response.attributes()).containsEntry("tier", "STANDARD"); // schema default applied

        ArgumentCaptor<RecordAuditLog> auditCaptor = ArgumentCaptor.forClass(RecordAuditLog.class);
        verify(recordAuditLogRepository).save(auditCaptor.capture());
        RecordAuditLog restoreAudit = auditCaptor.getValue();
        assertThat(restoreAudit.getOperation()).isEqualTo("RESTORE");
        assertThat(restoreAudit.getVersion()).isEqualTo(6L);
        assertThat(restoreAudit.getNewAttributes()).containsEntry("name", "Primacy Corp");

        verify(outboxEventPublisher).publish(eq("entity_record"), eq("1001"), eq("RECORD_RESTORED"), eq("tenant-corp"), any());
    }

    @Test
    void testCompositeMutations_AreForbidden() {
        EntityType composite = new EntityType();
        composite.setId(99L);
        composite.setIsComposite(true);
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(99L)).thenReturn(Optional.of(composite));

        assertThatThrownBy(() -> pipeline.executeCreate(99L, new CreateRecordRequest(Map.of(), "tenant-corp")))
                .isInstanceOf(UnsupportedOperationException.class)
                .hasMessageContaining("virtual and read-only");

        assertThatThrownBy(() -> pipeline.executeUpdate(99L, 1L, new UpdateRecordRequest(Map.of(), null, null), null))
                .isInstanceOf(UnsupportedOperationException.class);

        assertThatThrownBy(() -> pipeline.executePatch(99L, 1L, new PatchRecordRequest(Map.of(), null, null), null))
                .isInstanceOf(UnsupportedOperationException.class);

        assertThatThrownBy(() -> pipeline.executeDelete(99L, 1L))
                .isInstanceOf(UnsupportedOperationException.class);
    }

    @Test
    void testUpdateRecord_WithConcurrentConflictOnSameField_ThrowsMetadataConflictException() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));

        EntityRecord existing = new EntityRecord();
        existing.setId(1001L);
        existing.setEntityType(customerType);
        existing.setTenantId("tenant-corp");
        existing.setVersion(2L);
        // Server changed tier to GOLD
        existing.setAttributes(new HashMap<>(Map.of("name", "Acme", "tier", "GOLD")));

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(existing));

        // Client base was STANDARD, but client wants tier = PLATINUM
        Map<String, Object> baseAttrs = Map.of("name", "Acme", "tier", "STANDARD");
        Map<String, Object> incomingAttrs = Map.of("name", "Acme", "tier", "PLATINUM");

        UpdateRecordRequest updateReq = new UpdateRecordRequest(incomingAttrs, 1L, baseAttrs);

        assertThatThrownBy(() -> pipeline.executeUpdate(10L, 1001L, updateReq, null))
                .isInstanceOf(MetadataConflictException.class)
                .hasMessageContaining("Concurrent modification conflict on field 'tier'");
    }

    @Test
    void testExecutePatch_WithETagAndBaseAttributes_Succeeds() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));

        EntityRecord existing = new EntityRecord();
        existing.setId(1001L);
        existing.setEntityType(customerType);
        existing.setTenantId("tenant-corp");
        existing.setVersion(3L);
        existing.setAttributes(new HashMap<>(Map.of("name", "Acme Current", "tier", "VIP")));

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(existing));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        // Client version 2, base attributes provided for auto-merge
        PatchRecordRequest patchReq = new PatchRecordRequest(
                Map.of("phone", "12345"),
                2L,
                Map.of("name", "Acme Old", "tier", "VIP")
        );

        EntityRecordResponse response = pipeline.executePatch(10L, 1001L, patchReq, "W/\"2\"");
        assertThat(response.version()).isEqualTo(4L);
        assertThat(response.attributes()).containsEntry("phone", "12345");
        assertThat(response.attributes()).containsEntry("tier", "VIP");
    }

    @Test
    void testDeleteRecord_WithSetNullPolicy_ClearsReference() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));

        EntityRecord customer = new EntityRecord();
        customer.setId(1001L);
        customer.setTenantId("tenant-corp");
        customer.setEntityType(customerType);

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(customer));

        AttributeDefinition setNullAttr = new AttributeDefinition();
        setNullAttr.setEntityType(orderType);
        setNullAttr.setSystemName("customer_id");
        setNullAttr.setOptions(Map.of("targetEntityTypeId", 10L, "cascadePolicy", "SET_NULL"));
        setNullAttr.setIsArchived(false);

        when(attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull("tenant-corp")).thenReturn(List.of(setNullAttr));
        when(jdbcTemplate.queryForObject(any(String.class), eq(Integer.class), eq("tenant-corp"), eq(20L), eq("customer_id"), eq("1001")))
                .thenReturn(4);

        pipeline.executeDelete(10L, 1001L);

        verify(jdbcTemplate).update(
                contains("UPDATE UNIPOST_ENTITIES SET attributes = attributes - ?"),
                eq("customer_id"), eq("tenant-corp"), eq(20L), eq("customer_id"), eq("1001")
        );
        assertThat(customer.getDeletedDate()).isNotNull();
    }

    @Test
    void testDeleteRecord_WithPatternCGraphEdges_CascadeAndDetach() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));

        EntityRecord customer = new EntityRecord();
        customer.setId(1001L);
        customer.setTenantId("tenant-corp");
        customer.setEntityType(customerType);

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(customer));
        when(attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull("tenant-corp")).thenReturn(List.of());

        RelationshipType cascadeRelType = new RelationshipType();
        cascadeRelType.setSystemName("customer_profiles");
        cascadeRelType.setCascadePolicy("CASCADE");

        EntityRecord targetRecord = new EntityRecord();
        targetRecord.setId(2002L);

        EntityRelationship cascadeEdge = new EntityRelationship();
        cascadeEdge.setId(1L);
        cascadeEdge.setSourceEntity(customer);
        cascadeEdge.setTargetEntity(targetRecord);
        cascadeEdge.setRelationshipType(cascadeRelType);

        when(entityRelationshipRepository.findBySourceEntityIdAndDeletedDateIsNull(1001L)).thenReturn(List.of(cascadeEdge));
        when(entityRelationshipRepository.findByTargetEntityIdAndDeletedDateIsNull(1001L)).thenReturn(List.of());

        pipeline.executeDelete(10L, 1001L);

        assertThat(cascadeEdge.getDeletedDate()).isNotNull();
        assertThat(targetRecord.getDeletedDate()).isNotNull();
        verify(entityRelationshipRepository).save(cascadeEdge);
        verify(entityRecordRepository).save(targetRecord);
    }

    @Test
    void testDeleteRecord_WithPatternCRestrictEdge_ThrowsConflict409() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));

        EntityRecord customer = new EntityRecord();
        customer.setId(1001L);
        customer.setTenantId("tenant-corp");
        customer.setEntityType(customerType);

        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(customer));
        when(attributeDefinitionRepository.findByTenantIdAndDeletedDateIsNull("tenant-corp")).thenReturn(List.of());

        RelationshipType restrictRelType = new RelationshipType();
        restrictRelType.setSystemName("vital_links");
        restrictRelType.setCascadePolicy("RESTRICT");

        EntityRelationship restrictEdge = new EntityRelationship();
        restrictEdge.setId(2L);
        restrictEdge.setRelationshipType(restrictRelType);

        when(entityRelationshipRepository.findBySourceEntityIdAndDeletedDateIsNull(1001L)).thenReturn(List.of(restrictEdge));
        when(entityRelationshipRepository.findByTargetEntityIdAndDeletedDateIsNull(1001L)).thenReturn(List.of());

        assertThatThrownBy(() -> pipeline.executeDelete(10L, 1001L))
                .isInstanceOf(MetadataConflictException.class)
                .hasMessageContaining("active relationship edge exists in 'vital_links' (RESTRICT policy)");
    }

    @Test
    void testGetRecordAuditLogs_ReturnsMappedList() {
        RecordAuditLog log1 = RecordAuditLog.builder()
                .id(1L)
                .tenantId("tenant-corp")
                .recordId(1001L)
                .entityTypeId(10L)
                .operation("CREATE")
                .actor("admin")
                .version(1L)
                .createdAt(LocalDateTime.now())
                .build();

        when(recordAuditLogRepository.findByTenantIdAndEntityTypeIdAndRecordIdOrderByCreatedAtDesc("tenant-corp", 10L, 1001L))
                .thenReturn(List.of(log1));

        List<RecordAuditLogResponse> logs = pipeline.getRecordAuditLogs(10L, 1001L);
        assertThat(logs).hasSize(1);
        assertThat(logs.get(0).id()).isEqualTo(1L);
        assertThat(logs.get(0).operation()).isEqualTo("CREATE");
    }

    @Test
    void testExtractExpectedVersion_Formats() {
        assertThat(pipeline.extractExpectedVersion("\"5\"", null)).isEqualTo(5L);
        assertThat(pipeline.extractExpectedVersion("W/\"5\"", null)).isEqualTo(5L);
        assertThat(pipeline.extractExpectedVersion("5", null)).isEqualTo(5L);
        assertThat(pipeline.extractExpectedVersion("invalid", 10L)).isEqualTo(10L);
        assertThat(pipeline.extractExpectedVersion(null, 7L)).isEqualTo(7L);
    }

    @Test
    void testPreviewRestore_AuditLogNotFound_ThrowsNotFound() {
        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));
        EntityRecord currentRecord = new EntityRecord();
        currentRecord.setId(1001L);
        currentRecord.setTenantId("tenant-corp");
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(10L, 1001L)).thenReturn(Optional.of(currentRecord));
        when(recordAuditLogRepository.findByTenantIdAndEntityTypeIdAndRecordIdAndId("tenant-corp", 10L, 1001L, 999L))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> pipeline.previewRestore(10L, 1001L, 999L))
                .isInstanceOf(MetadataNotFoundException.class)
                .hasMessageContaining("Audit log entry not found");
    }

    @Test
    void testApplicationEventPublisher_FiresMutationEventOnCreate() {
        org.springframework.context.ApplicationEventPublisher mockPublisher = mock(org.springframework.context.ApplicationEventPublisher.class);
        pipeline.setApplicationEventPublisher(mockPublisher);

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(10L)).thenReturn(Optional.of(customerType));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(invocation -> {
            EntityRecord r = invocation.getArgument(0);
            r.setId(777L);
            r.setVersion(1L);
            return r;
        });

        CreateRecordRequest request = new CreateRecordRequest(Map.of("name", "Event Test Corp"), "tenant-corp");
        pipeline.executeCreate(10L, request);

        org.mockito.ArgumentCaptor<Object> captor = org.mockito.ArgumentCaptor.forClass(Object.class);
        verify(mockPublisher, atLeastOnce()).publishEvent(captor.capture());

        Object published = captor.getValue();
        assertThat(published).isInstanceOf(com.acc.domain.metadata.EntityRecordMutatedEvent.class);
        com.acc.domain.metadata.EntityRecordMutatedEvent event = (com.acc.domain.metadata.EntityRecordMutatedEvent) published;
        assertThat(event.entityTypeId()).isEqualTo(10L);
        assertThat(event.recordId()).isEqualTo(777L);
        assertThat(event.action()).isEqualTo("CREATE");
        assertThat(event.tenantId()).isEqualTo("tenant-corp");
    }
}

