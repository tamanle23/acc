package com.acc.workflow.adapters;

import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.ports.PersistencePort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Abstract Persistence Contract Test suite.
 * Run identically against InMemoryPersistenceAdapter, SqliteJdbcPersistenceAdapter, and Postgres.
 */
public abstract class PersistenceContractTest {

    protected abstract PersistencePort createPersistencePort();

    @Test
    @DisplayName("Contract: should save and retrieve workflow execution with snapshot")
    void testWorkflowExecutionLifecycle() {
        PersistencePort port = createPersistencePort();
        WorkflowDefinition def = WorkflowDefinition.builder("contract-wf")
            .version(1)
            .tasks(List.of(TaskDefinition.builder("task-1").build()))
            .build();

        long now = 1000L;
        port.saveWorkflowExecution(
            "wf-c1", "t1", "ws1", "contract-wf", 1, WorkflowStatus.RUNNING,
            def, Map.of("order", "100"), Collections.emptyMap(), null, now
        );

        Optional<WorkflowSnapshot> snapOpt = port.getWorkflowSnapshot("wf-c1");
        assertThat(snapOpt).isPresent();
        WorkflowSnapshot snap = snapOpt.get();
        assertThat(snap.workflowId()).isEqualTo("wf-c1");
        assertThat(snap.status()).isEqualTo(WorkflowStatus.RUNNING);
        assertThat(snap.inputPayload()).containsEntry("order", "100");

        port.updateWorkflowStatus("wf-c1", WorkflowStatus.COMPLETED, Map.of("res", "OK"), null, 2000L);
        WorkflowSnapshot updated = port.getWorkflowSnapshot("wf-c1").orElseThrow();
        assertThat(updated.status()).isEqualTo(WorkflowStatus.COMPLETED);
        assertThat(updated.outputPayload()).containsEntry("res", "OK");
    }

    @Test
    @DisplayName("Contract: should enqueue, atomically poll, renew lease, and sweep expired tasks")
    void testQueueLeasingAndPolling() {
        PersistencePort port = createPersistencePort();

        port.saveTaskExecution(
            "task_q1", "wf-q", "t1", "ws1", "step1", "SIMPLE", "default",
            TaskStatus.SCHEDULED, 1, Map.of("in", 1), Collections.emptyMap(),
            null, 15000L, 1000L
        );
        port.enqueueTask("task_q1", "wf-q", "t1", "ws1", "SIMPLE", "default", 10, 1000L);

        // Poll at now = 1000L
        List<TaskSnapshot> polled = port.pollTasks("t1", "SIMPLE", "default", 5, "worker-alpha", 15000L, 1000L);
        assertThat(polled).hasSize(1);
        TaskSnapshot task = polled.get(0);
        assertThat(task.taskId()).isEqualTo("task_q1");
        assertThat(task.status()).isEqualTo(TaskStatus.IN_PROGRESS);

        // Immediate second poll should find 0 tasks because lease is active until 16000L
        List<TaskSnapshot> polledAgain = port.pollTasks("t1", "SIMPLE", "default", 5, "worker-beta", 15000L, 1050L);
        assertThat(polledAgain).isEmpty();

        // Renew lease
        boolean renewed = port.renewLease("task_q1", "worker-alpha", 25000L);
        assertThat(renewed).isTrue();

        // At 20000L, lease is still active (until 25000L) -> 0 expired tasks
        List<TaskSnapshot> expiredEarly = port.findExpiredLeaseTasks(20000L);
        assertThat(expiredEarly).isEmpty();

        // At 30000L, lease has expired!
        List<TaskSnapshot> expired = port.findExpiredLeaseTasks(30000L);
        assertThat(expired).hasSize(1);
        assertThat(expired.get(0).taskId()).isEqualTo("task_q1");
    }

    @Test
    @DisplayName("Contract: should quarantine, query, update, and delete DLQ records")
    void testDeadLetterQueueOperations() {
        PersistencePort port = createPersistencePort();

        com.acc.workflow.core.model.TaskDlqRecord record = new com.acc.workflow.core.model.TaskDlqRecord(
            "dlq-101", "task_dlq_1", "wf-101", "tenant-alpha", "ws-default",
            "HTTP", "default", "Connection refused: api.partner.com",
            "java.net.ConnectException: Connection refused", Map.of("url", "https://api.partner.com"),
            3, 50000L, null, "ISOLATED"
        );

        port.quarantineTaskToDlq(record);

        // List DLQ by tenant
        List<com.acc.workflow.core.model.TaskDlqRecord> list = port.listDlqTasks("tenant-alpha", "ISOLATED", 10);
        assertThat(list).hasSize(1);
        assertThat(list.get(0).dlqId()).isEqualTo("dlq-101");
        assertThat(list.get(0).errorMessage()).contains("Connection refused");

        // Get by ID
        Optional<com.acc.workflow.core.model.TaskDlqRecord> fetched = port.getDlqTask("dlq-101");
        assertThat(fetched).isPresent();
        assertThat(fetched.get().status()).isEqualTo("ISOLATED");

        // Update status to REPLAYED
        port.updateDlqStatus("dlq-101", "REPLAYED", 55000L);
        Optional<com.acc.workflow.core.model.TaskDlqRecord> replayed = port.getDlqTask("dlq-101");
        assertThat(replayed).isPresent();
        assertThat(replayed.get().status()).isEqualTo("REPLAYED");
        assertThat(replayed.get().replayedAtMs()).isEqualTo(55000L);

        // Delete from DLQ
        port.deleteDlqTask("dlq-101");
        assertThat(port.getDlqTask("dlq-101")).isEmpty();
    }

    @Test
    @DisplayName("Contract: should save, retrieve, version, and manage Task Definitions")
    void testTaskDefinitionLifecycle() {
        PersistencePort port = createPersistencePort();
        com.acc.workflow.core.model.TaskDefinitionRecord v1 = com.acc.workflow.core.model.TaskDefinitionRecord.builder("validateOrder")
            .tenantId("tenant-alpha")
            .version(1)
            .status(com.acc.workflow.core.model.WorkflowVersionStatus.ACTIVE)
            .description("Validates user cart and items")
            .inputSchema(Map.of("type", "object", "properties", Map.of("orderId", Map.of("type", "string"))))
            .outputSchema(Map.of("type", "object", "properties", Map.of("valid", Map.of("type", "boolean"))))
            .publishedAtMs(1000L)
            .publishedBy("admin")
            .changelogNote("Initial version")
            .build();

        port.saveTaskDefinition(v1);

        Optional<com.acc.workflow.core.model.TaskDefinitionRecord> fetchedV1 = port.getTaskDefinition("tenant-alpha", "validateOrder", 1);
        assertThat(fetchedV1).isPresent();
        assertThat(fetchedV1.get().name()).isEqualTo("validateOrder");
        assertThat(fetchedV1.get().version()).isEqualTo(1);
        assertThat(fetchedV1.get().status()).isEqualTo(com.acc.workflow.core.model.WorkflowVersionStatus.ACTIVE);

        // Save draft v2
        com.acc.workflow.core.model.TaskDefinitionRecord v2Draft = com.acc.workflow.core.model.TaskDefinitionRecord.builder("validateOrder")
            .tenantId("tenant-alpha")
            .version(2)
            .status(com.acc.workflow.core.model.WorkflowVersionStatus.DRAFT)
            .description("Validates user cart and coupon codes")
            .changelogNote("Adding promo code check")
            .build();
        port.saveTaskDefinition(v2Draft);

        // Latest ACTIVE should still be v1
        Optional<com.acc.workflow.core.model.TaskDefinitionRecord> latestActive = port.getLatestActiveTaskDefinition("tenant-alpha", "validateOrder");
        assertThat(latestActive).isPresent();
        assertThat(latestActive.get().version()).isEqualTo(1);

        // List all versions of validateOrder
        List<com.acc.workflow.core.model.TaskDefinitionRecord> allVersions = port.listTaskDefinitionVersions("tenant-alpha", "validateOrder");
        assertThat(allVersions).hasSize(2);

        // Publish v2
        port.updateTaskDefinitionStatus("tenant-alpha", "validateOrder", 2, com.acc.workflow.core.model.WorkflowVersionStatus.ACTIVE, 2500L, "lead-eng");

        Optional<com.acc.workflow.core.model.TaskDefinitionRecord> newLatest = port.getLatestActiveTaskDefinition("tenant-alpha", "validateOrder");
        assertThat(newLatest).isPresent();
        assertThat(newLatest.get().version()).isEqualTo(2);
        assertThat(newLatest.get().status()).isEqualTo(com.acc.workflow.core.model.WorkflowVersionStatus.ACTIVE);
        assertThat(newLatest.get().publishedBy()).isEqualTo("lead-eng");

        // List task definitions for tenant
        List<com.acc.workflow.core.model.TaskDefinitionRecord> tenantDefs = port.listTaskDefinitions("tenant-alpha");
        assertThat(tenantDefs).hasSize(1);
        assertThat(tenantDefs.get(0).version()).isEqualTo(2);
    }
}


