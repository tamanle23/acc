package com.acc.service.workflow;

import com.acc.domain.metadata.EntityRecordMutatedEvent;
import com.acc.domain.metadata.EntityStateChangedEvent;
import com.acc.presentation.NotificationSseController;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EntityWorkflowTriggerDispatcherTest {

    @Mock
    private NotificationSseController notificationSseController;

    private EntityWorkflowTriggerDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new EntityWorkflowTriggerDispatcher(notificationSseController);
    }

    @Test
    void testOnEntityRecordMutated_CreateAction_BroadcastsMutationAndApproval() {
        EntityRecordMutatedEvent event = new EntityRecordMutatedEvent(
                1L, 100L, "tenant-test", "CREATE", "alice@acc.io",
                1L, Map.of("name", "New Item"), null, Instant.now()
        );

        dispatcher.onEntityRecordMutated(event);

        verify(notificationSseController).broadcast(eq("tenant-test"), eq("ENTITY_MUTATED"), any());
        verify(notificationSseController).broadcast(eq("tenant-test"), eq("APPROVAL_REQUESTED"), any());
    }

    @Test
    void testOnEntityRecordMutated_UpdateAction_BroadcastsMutationOnly() {
        EntityRecordMutatedEvent event = new EntityRecordMutatedEvent(
                1L, 100L, "tenant-test", "UPDATE", "alice@acc.io",
                2L, Map.of("name", "Updated Item"), Map.of("name", "Updated Item"), Instant.now()
        );

        dispatcher.onEntityRecordMutated(event);

        verify(notificationSseController).broadcast(eq("tenant-test"), eq("ENTITY_MUTATED"), any());
        verify(notificationSseController, never()).broadcast(eq("tenant-test"), eq("APPROVAL_REQUESTED"), any());
    }

    @Test
    void testOnEntityRecordMutated_SubmittedForApproval_BroadcastsBoth() {
        EntityRecordMutatedEvent event = new EntityRecordMutatedEvent(
                2L, 200L, "tenant-finance", "SUBMITTED_FOR_APPROVAL", "bob@acc.io",
                3L, Map.of("amount", 5000), null, Instant.now()
        );

        dispatcher.onEntityRecordMutated(event);

        verify(notificationSseController).broadcast(eq("tenant-finance"), eq("ENTITY_MUTATED"), any());
        verify(notificationSseController).broadcast(eq("tenant-finance"), eq("APPROVAL_REQUESTED"), any());
    }

    @Test
    void testOnEntityStateChanged_BroadcastsStateChanged() {
        EntityStateChangedEvent event = new EntityStateChangedEvent(
                "tenant-hr", 3L, 300L, "DRAFT", "PENDING_APPROVAL",
                "SUBMIT", "carol@acc.io", Map.of("status", "PENDING_APPROVAL"), Instant.now()
        );

        dispatcher.onEntityStateChanged(event);

        ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
        verify(notificationSseController).broadcast(eq("tenant-hr"), eq("ENTITY_STATE_CHANGED"), payloadCaptor.capture());

        Object payload = payloadCaptor.getValue();
        assertNotNull(payload);
        assertTrue(payload instanceof Map);
        Map<?, ?> map = (Map<?, ?>) payload;
        assertEquals("DRAFT", map.get("oldState"));
        assertEquals("PENDING_APPROVAL", map.get("newState"));
        assertEquals(300L, map.get("recordId"));
    }
}
