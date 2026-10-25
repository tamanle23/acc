package com.acc.service.workflow;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.acc.domain.metadata.EntityRecord;
import com.acc.domain.metadata.EntityStateChangedEvent;
import com.acc.domain.metadata.EntityType;
import com.acc.domain.metadata.LifecycleConfig;
import com.acc.domain.metadata.TransitionConfig;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.outbox.OutboxEventPublisher;
import com.acc.presentation.dto.metadata.EntityRecordResponse;
import com.acc.repository.jpa.AttributeDefinitionRepository;
import com.acc.repository.jpa.EntityRecordRepository;
import com.acc.repository.jpa.EntityRelationshipRepository;
import com.acc.repository.jpa.EntityTypeRepository;
import com.acc.repository.jpa.RelationshipTypeRepository;
import com.acc.service.MetadataService;
import com.acc.service.PageBuilder;
import com.acc.service.SchemaValidationService;
import com.acc.service.exception.MetadataConflictException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Formal end-to-end integration test for the 5-Gate Sequential Validation FSM Engine
 * wired into MetadataService.transitionRecordState adhering strictly to ZERO-STUB-PROHIBITION.
 */
class EntityLifecycleFsmIntegrationTest {

    private EntityTypeRepository entityTypeRepository;
    private AttributeDefinitionRepository attributeDefinitionRepository;
    private EntityRecordRepository entityRecordRepository;
    private RelationshipTypeRepository relationshipTypeRepository;
    private EntityRelationshipRepository entityRelationshipRepository;
    private SchemaValidationService schemaValidationService;
    private OutboxEventPublisher outboxEventPublisher;
    private ApplicationEventPublisher eventPublisher;
    private EntityLifecycleService lifecycleService;
    private MetadataService metadataService;

    @BeforeEach
    void setUp() {
        TenantContextHolder.setTenantId("tenant-finance");

        entityTypeRepository = mock(EntityTypeRepository.class);
        attributeDefinitionRepository = mock(AttributeDefinitionRepository.class);
        entityRecordRepository = mock(EntityRecordRepository.class);
        relationshipTypeRepository = mock(RelationshipTypeRepository.class);
        entityRelationshipRepository = mock(EntityRelationshipRepository.class);
        schemaValidationService = mock(SchemaValidationService.class);
        outboxEventPublisher = mock(OutboxEventPublisher.class);
        eventPublisher = mock(ApplicationEventPublisher.class);

        // Real production SpEL evaluator and real production lifecycle engine
        SpelGuardEvaluator guardEvaluator = new SpelGuardEvaluator();
        lifecycleService = new EntityLifecycleService(guardEvaluator, eventPublisher);

        metadataService = new MetadataService(
                entityTypeRepository,
                attributeDefinitionRepository,
                entityRecordRepository,
                relationshipTypeRepository,
                entityRelationshipRepository,
                schemaValidationService,
                eventPublisher,
                mock(PageBuilder.class),
                new ObjectMapper()
        );
        metadataService.setOutboxEventPublisher(outboxEventPublisher);
        metadataService.setEntityLifecycleService(lifecycleService);
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        SecurityContextHolder.clearContext();
    }

    private EntityType buildPurchaseOrderType() {
        EntityType type = new EntityType();
        type.setId(42L);
        type.setSystemName("purchase_order");
        type.setTenantId("tenant-finance");
        type.setSchemaVersion(2L);

        TransitionConfig draftToSubmitted = new TransitionConfig(
                "DRAFT",
                "PENDING_APPROVAL",
                "SUBMIT",
                List.of("amount", "vendor"),
                "#attributes['amount'] > 0",
                List.of("ROLE_OPERATOR", "ROLE_ADMIN")
        );

        TransitionConfig approveOrder = new TransitionConfig(
                "PENDING_APPROVAL",
                "APPROVED",
                "APPROVE",
                List.of("approval_comment"),
                "#attributes['amount'] <= 100000",
                List.of("ROLE_ADMIN")
        );

        LifecycleConfig config = new LifecycleConfig(
                "status",
                "DRAFT",
                List.of("DRAFT", "PENDING_APPROVAL", "APPROVED", "REJECTED"),
                List.of(draftToSubmitted, approveOrder)
        );

        type.setLifecycleConfig(config);
        return type;
    }

    @Test
    @DisplayName("End-to-End FSM Transition: Successfully validate 5 gates, mutate state, emit outbox & spring events")
    void testEndToEndTransitionSuccess() {
        EntityType orderType = buildPurchaseOrderType();
        EntityRecord record = new EntityRecord();
        record.setId(501L);
        record.setEntityType(orderType);
        record.setTenantId("tenant-finance");
        record.setAttributes(new HashMap<>(Map.of(
                "status", "DRAFT",
                "vendor", "ACME Corp",
                "amount", 25000
        )));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(42L)).thenReturn(Optional.of(orderType));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(42L, 501L)).thenReturn(Optional.of(record));
        when(entityRecordRepository.save(any(EntityRecord.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("sarah_ops", "cred", List.of(new SimpleGrantedAuthority("ROLE_OPERATOR")))
        );

        // Execute transition through MetadataService
        EntityRecordResponse response = metadataService.transitionRecordState(
                42L,
                501L,
                "SUBMIT",
                Map.of("submission_note", "Urgent batch")
        );

        assertNotNull(response);
        assertEquals("PENDING_APPROVAL", response.attributes().get("status"));
        assertEquals("Urgent batch", response.attributes().get("submission_note"));
        assertEquals(2L, record.getSchemaVersion());

        // Verify Gate 5 completed and Spring Event published
        ArgumentCaptor<EntityStateChangedEvent> eventCaptor = ArgumentCaptor.forClass(EntityStateChangedEvent.class);
        verify(eventPublisher, times(1)).publishEvent(eventCaptor.capture());
        EntityStateChangedEvent domainEvent = eventCaptor.getValue();
        assertEquals("DRAFT", domainEvent.oldState());
        assertEquals("PENDING_APPROVAL", domainEvent.newState());
        assertEquals("SUBMIT", domainEvent.action());
        assertEquals("sarah_ops", domainEvent.triggeredBy());

        // Verify Outbox Event published for distributed saga / replication
        verify(outboxEventPublisher, times(1)).publish(
                eq("entity_record"),
                eq("501"),
                eq("RECORD_TRANSITIONED"),
                eq("tenant-finance"),
                any()
        );
    }

    @Test
    @DisplayName("FSM Transition Failure: SpEL Guard Rejection (amount exceeds threshold)")
    void testTransitionFailsOnSpelGuardViolation() {
        EntityType orderType = buildPurchaseOrderType();
        EntityRecord record = new EntityRecord();
        record.setId(502L);
        record.setEntityType(orderType);
        record.setTenantId("tenant-finance");
        record.setAttributes(new HashMap<>(Map.of(
                "status", "PENDING_APPROVAL",
                "vendor", "MegaCorp",
                "amount", 250000 // exceeds guard <= 100000
        )));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(42L)).thenReturn(Optional.of(orderType));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(42L, 502L)).thenReturn(Optional.of(record));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("boss", "cred", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))
        );

        MetadataConflictException ex = assertThrows(MetadataConflictException.class, () ->
                metadataService.transitionRecordState(42L, 502L, "APPROVE", Map.of("approval_comment", "Looks fine"))
        );

        assertTrue(ex.getMessage().contains("FSM Guard Gate Violation"));
        verify(entityRecordRepository, never()).save(any());
        verify(outboxEventPublisher, never()).publish(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("FSM Transition Failure: Missing mandatory required attribute")
    void testTransitionFailsOnMissingRequiredAttribute() {
        EntityType orderType = buildPurchaseOrderType();
        EntityRecord record = new EntityRecord();
        record.setId(503L);
        record.setEntityType(orderType);
        record.setTenantId("tenant-finance");
        record.setAttributes(new HashMap<>(Map.of(
                "status", "PENDING_APPROVAL",
                "vendor", "MegaCorp",
                "amount", 50000
        )));

        when(entityTypeRepository.findByIdAndDeletedDateIsNull(42L)).thenReturn(Optional.of(orderType));
        when(entityRecordRepository.findByEntityTypeIdAndIdAndDeletedDateIsNull(42L, 503L)).thenReturn(Optional.of(record));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("boss", "cred", List.of(new SimpleGrantedAuthority("ROLE_ADMIN")))
        );

        // Missing required 'approval_comment'
        MetadataConflictException ex = assertThrows(MetadataConflictException.class, () ->
                metadataService.transitionRecordState(42L, 503L, "APPROVE", Map.of())
        );

        assertTrue(ex.getMessage().contains("mandatory for action 'APPROVE'"));
        verify(entityRecordRepository, never()).save(any());
    }
}
