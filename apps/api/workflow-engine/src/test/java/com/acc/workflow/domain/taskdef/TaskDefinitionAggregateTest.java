package com.acc.workflow.domain.taskdef;

import com.acc.core.domain.exception.DomainValidationException;
import com.acc.core.domain.exception.ImmutableVersionConflictException;
import com.acc.workflow.domain.taskdef.model.TaskDefinitionAggregate;
import com.acc.workflow.domain.taskdef.valobj.TaskDefId;
import com.acc.workflow.domain.taskdef.valobj.TaskStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class TaskDefinitionAggregateTest {

    @Test
    @DisplayName("hardForkNewDraft initializes version 1 when no previous versions exist")
    void testInitialDraftCreation() {
        long now = System.currentTimeMillis();
        TaskDefinitionAggregate draft = TaskDefinitionAggregate.hardForkNewDraft(
            null, "tenant-1", "processPayment", "Processes customer payment",
            3, 5, 2.0, 30, Map.of("amount", "number"), Map.of("status", "string"),
            Map.of(), "Initial creation", now
        );

        assertNotNull(draft.getId());
        assertEquals("tenant-1", draft.tenantId());
        assertEquals("processPayment", draft.name());
        assertEquals(1, draft.version());
        assertEquals(TaskStatus.DRAFT, draft.status());
        assertEquals("Processes customer payment", draft.description());
    }

    @Test
    @DisplayName("hardForkNewDraft mutates draft in-place when latest version is DRAFT")
    void testDraftInPlaceMutation() {
        long now = System.currentTimeMillis();
        TaskDefinitionAggregate v1 = TaskDefinitionAggregate.hardForkNewDraft(
            null, "tenant-1", "generateInvoice", "Initial description",
            3, 5, 2.0, 30, Map.of(), Map.of(), Map.of(), "v1 draft", now
        );

        TaskDefId originalId = v1.getId();

        TaskDefinitionAggregate updated = TaskDefinitionAggregate.hardForkNewDraft(
            v1, "tenant-1", "generateInvoice", "Updated description",
            5, 10, 1.5, 60, Map.of("invId", "string"), Map.of(), Map.of(), "updated draft", now + 1000
        );

        assertSame(v1, updated);
        assertEquals(originalId, updated.getId());
        assertEquals(1, updated.version());
        assertEquals(TaskStatus.DRAFT, updated.status());
        assertEquals("Updated description", updated.description());
        assertEquals(5, updated.retryCount());
    }

    @Test
    @DisplayName("hardForkNewDraft increments version to v_max + 1 when latest version is ACTIVE")
    void testHardForkOnActiveVersion() {
        long now = System.currentTimeMillis();
        TaskDefinitionAggregate v1 = TaskDefinitionAggregate.hardForkNewDraft(
            null, "tenant-1", "sendNotification", "Notification sender",
            3, 2, 2.0, 15, Map.of(), Map.of(), Map.of(), "v1 draft", now
        );
        v1.promoteToActive(now + 100);

        TaskDefinitionAggregate v2 = TaskDefinitionAggregate.hardForkNewDraft(
            v1, "tenant-1", "sendNotification", "Notification sender v2",
            3, 2, 2.0, 15, Map.of("channel", "string"), Map.of(), Map.of(), "forking v2", now + 200
        );

        assertNotEquals(v1.getId(), v2.getId());
        assertEquals(2, v2.version());
        assertEquals(TaskStatus.DRAFT, v2.status());
        assertEquals(TaskStatus.ACTIVE, v1.status());
    }

    @Test
    @DisplayName("updateDraft on ACTIVE version throws ImmutableVersionConflictException")
    void testCannotMutateActiveVersionDirectly() {
        long now = System.currentTimeMillis();
        TaskDefinitionAggregate v1 = TaskDefinitionAggregate.hardForkNewDraft(
            null, "tenant-1", "immutableTask", "desc",
            3, 2, 2.0, 15, Map.of(), Map.of(), Map.of(), "v1", now
        );
        v1.promoteToActive(now + 50);

        assertThrows(ImmutableVersionConflictException.class, () ->
            v1.updateDraft("new desc", 1, 1, 1.0, 10, Map.of(), Map.of(), Map.of(), "note", now + 100)
        );
    }

    @Test
    @DisplayName("promoteToActive on ARCHIVED version throws DomainValidationException")
    void testCannotPromoteArchivedVersion() {
        long now = System.currentTimeMillis();
        TaskDefinitionAggregate task = new TaskDefinitionAggregate(
            TaskDefId.random(), "tenant-1", "archivedTask", 1, TaskStatus.ARCHIVED,
            "desc", 1, 1, 1.0, 10, Map.of(), Map.of(), Map.of(), "note", now, now
        );

        assertThrows(DomainValidationException.class, () -> task.promoteToActive(now + 100));
    }
}
