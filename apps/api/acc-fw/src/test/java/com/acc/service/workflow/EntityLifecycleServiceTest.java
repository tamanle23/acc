package com.acc.service.workflow;

import com.acc.domain.metadata.EntityRecord;
import com.acc.domain.metadata.EntityStateChangedEvent;
import com.acc.domain.metadata.EntityType;
import com.acc.domain.metadata.LifecycleConfig;
import com.acc.domain.metadata.TransitionConfig;
import com.acc.fw.tenancy.TenantContextHolder;
import com.acc.service.exception.MetadataConflictException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class EntityLifecycleServiceTest {

    private SpelGuardEvaluator guardEvaluator;
    private ApplicationEventPublisher eventPublisher;
    private EntityLifecycleService lifecycleService;

    @BeforeEach
    void setUp() {
        guardEvaluator = new SpelGuardEvaluator();
        eventPublisher = mock(ApplicationEventPublisher.class);
        lifecycleService = new EntityLifecycleService(guardEvaluator, eventPublisher);
        TenantContextHolder.setTenantId("tenant-alpha");
    }

    @AfterEach
    void tearDown() {
        TenantContextHolder.clear();
        SecurityContextHolder.clearContext();
    }

    private EntityType createTestEntityTypeWithLifecycle() {
        EntityType type = new EntityType();
        type.setId(10L);
        type.setSystemName("job_order");
        type.setTenantId("tenant-alpha");

        TransitionConfig draftToSubmitted = new TransitionConfig(
                "DRAFT",
                "SUBMITTED",
                "SUBMIT",
                List.of("title", "cost"),
                "#attributes['cost'] > 0",
                List.of("ROLE_CREATOR", "ROLE_ADMIN")
        );

        TransitionConfig submittedToApproved = new TransitionConfig(
                "SUBMITTED",
                "APPROVED",
                "APPROVE",
                List.of("approver_notes"),
                null,
                List.of("ROLE_ADMIN")
        );

        LifecycleConfig config = new LifecycleConfig(
                "status",
                "DRAFT",
                List.of("DRAFT", "SUBMITTED", "APPROVED", "REJECTED"),
                List.of(draftToSubmitted, submittedToApproved)
        );

        type.setLifecycleConfig(config);
        return type;
    }

    @Test
    void testInitializeStateOnCreation() {
        EntityType type = createTestEntityTypeWithLifecycle();
        Map<String, Object> attrs = new HashMap<>();

        lifecycleService.initializeStateOnCreation(type, attrs);

        assertEquals("DRAFT", attrs.get("status"));
    }

    @Test
    void testTransitionSuccess() {
        EntityType type = createTestEntityTypeWithLifecycle();
        EntityRecord record = new EntityRecord();
        record.setId(100L);
        record.setEntityType(type);
        record.setTenantId("tenant-alpha");
        record.setAttributes(new HashMap<>(Map.of("status", "DRAFT", "title", "Repair server", "cost", 150)));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("john", "pwd", List.of(new SimpleGrantedAuthority("ROLE_CREATOR")))
        );

        Map<String, Object> updateAttrs = new HashMap<>(record.getAttributes());
        String targetState = lifecycleService.validateAndExecuteTransition(record, "SUBMIT", updateAttrs);

        assertEquals("SUBMITTED", targetState);
        assertEquals("SUBMITTED", updateAttrs.get("status"));
        assertEquals("SUBMITTED", record.getAttributes().get("status"));

        ArgumentCaptor<EntityStateChangedEvent> captor = ArgumentCaptor.forClass(EntityStateChangedEvent.class);
        verify(eventPublisher, times(1)).publishEvent(captor.capture());
        EntityStateChangedEvent event = captor.getValue();
        assertEquals("DRAFT", event.oldState());
        assertEquals("SUBMITTED", event.newState());
        assertEquals("SUBMIT", event.action());
        assertEquals("tenant-alpha", event.tenantId());
    }

    @Test
    void testGate1_TenantMismatchThrowsConflict() {
        EntityType type = createTestEntityTypeWithLifecycle();
        EntityRecord record = new EntityRecord();
        record.setId(101L);
        record.setEntityType(type);
        record.setTenantId("tenant-beta"); // Different from active tenant
        record.setAttributes(new HashMap<>(Map.of("status", "DRAFT")));

        assertThrows(MetadataConflictException.class, () ->
                lifecycleService.validateAndExecuteTransition(record, "SUBMIT", new HashMap<>(record.getAttributes()))
        );
    }

    @Test
    void testGate2_InvalidActionForCurrentState() {
        EntityType type = createTestEntityTypeWithLifecycle();
        EntityRecord record = new EntityRecord();
        record.setId(102L);
        record.setEntityType(type);
        record.setTenantId("tenant-alpha");
        record.setAttributes(new HashMap<>(Map.of("status", "DRAFT")));

        // APPROVE is only allowed from SUBMITTED, not DRAFT
        assertThrows(MetadataConflictException.class, () ->
                lifecycleService.validateAndExecuteTransition(record, "APPROVE", new HashMap<>(record.getAttributes()))
        );
    }

    @Test
    void testGate3_UnauthorizedRoleThrowsConflict() {
        EntityType type = createTestEntityTypeWithLifecycle();
        EntityRecord record = new EntityRecord();
        record.setId(103L);
        record.setEntityType(type);
        record.setTenantId("tenant-alpha");
        record.setAttributes(new HashMap<>(Map.of("status", "DRAFT", "title", "Task", "cost", 50)));

        // User only has ROLE_VIEWER
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("alice", "pwd", List.of(new SimpleGrantedAuthority("ROLE_VIEWER")))
        );

        MetadataConflictException ex = assertThrows(MetadataConflictException.class, () ->
                lifecycleService.validateAndExecuteTransition(record, "SUBMIT", new HashMap<>(record.getAttributes()))
        );
        assertTrue(ex.getMessage().contains("Access Denied"));
    }

    @Test
    void testGate4_MissingRequiredAttributeThrowsConflict() {
        EntityType type = createTestEntityTypeWithLifecycle();
        EntityRecord record = new EntityRecord();
        record.setId(104L);
        record.setEntityType(type);
        record.setTenantId("tenant-alpha");
        // missing 'cost' attribute
        record.setAttributes(new HashMap<>(Map.of("status", "DRAFT", "title", "Task")));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("john", "pwd", List.of(new SimpleGrantedAuthority("ROLE_CREATOR")))
        );

        MetadataConflictException ex = assertThrows(MetadataConflictException.class, () ->
                lifecycleService.validateAndExecuteTransition(record, "SUBMIT", new HashMap<>(record.getAttributes()))
        );
        assertTrue(ex.getMessage().contains("mandatory for action"));
    }

    @Test
    void testGate5_SpelGuardExpressionEvaluatesFalseThrowsConflict() {
        EntityType type = createTestEntityTypeWithLifecycle();
        EntityRecord record = new EntityRecord();
        record.setId(105L);
        record.setEntityType(type);
        record.setTenantId("tenant-alpha");
        // cost is -10 (violates guard #attributes['cost'] > 0)
        record.setAttributes(new HashMap<>(Map.of("status", "DRAFT", "title", "Task", "cost", -10)));

        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("john", "pwd", List.of(new SimpleGrantedAuthority("ROLE_CREATOR")))
        );

        MetadataConflictException ex = assertThrows(MetadataConflictException.class, () ->
                lifecycleService.validateAndExecuteTransition(record, "SUBMIT", new HashMap<>(record.getAttributes()))
        );
        assertTrue(ex.getMessage().contains("FSM Guard Gate Violation"));
    }
}
