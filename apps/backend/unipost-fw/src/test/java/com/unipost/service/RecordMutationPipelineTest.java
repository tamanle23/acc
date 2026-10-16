package com.unipost.service;

import com.unipost.domain.metadata.*;
import com.unipost.fw.tenancy.TenantContextHolder;
import com.unipost.outbox.OutboxEventPublisher;
import com.unipost.presentation.dto.metadata.*;
import com.unipost.repository.jpa.*;
import com.unipost.service.exception.MetadataConflictException;
import com.unipost.service.exception.MetadataNotFoundException;
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
}
