package com.unipost.workflow.ports;

import com.unipost.workflow.core.model.TaskDlqRecord;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Persistence port contract for workflow executions, task executions, and the lease queue.
 */
public interface PersistencePort {

    UnitOfWork openUnitOfWork();

    // Workflow executions
    void saveWorkflowExecution(
        String workflowId,
        String tenantId,
        String workspaceId,
        String workflowName,
        int version,
        WorkflowStatus status,
        WorkflowDefinition definitionSnapshot,
        Map<String, Object> inputPayload,
        Map<String, Object> outputPayload,
        String failureReason,
        long nowEpochMs
    );

    void updateWorkflowStatus(
        String workflowId,
        WorkflowStatus status,
        Map<String, Object> outputPayload,
        String failureReason,
        long nowEpochMs
    );

    Optional<WorkflowSnapshot> getWorkflowSnapshot(String workflowId);

    List<WorkflowSnapshot> listWorkflowExecutions(String tenantId, String workflowKey, WorkflowStatus status);

    // Task executions
    void saveTaskExecution(
        String taskId,
        String workflowId,
        String tenantId,
        String workspaceId,
        String referenceName,
        String taskType,
        String domain,
        TaskStatus status,
        int attempt,
        Map<String, Object> inputPayload,
        Map<String, Object> outputPayload,
        String errorDetails,
        long responseTimeoutMs,
        long nowEpochMs
    );

    void updateTaskExecution(
        String taskId,
        TaskStatus status,
        Map<String, Object> outputPayload,
        String errorDetails,
        long nowEpochMs
    );

    Optional<TaskSnapshot> getTaskExecution(String taskId);

    // Single-column lease queue
    void enqueueTask(
        String taskId,
        String workflowId,
        String tenantId,
        String workspaceId,
        String taskType,
        String domain,
        int priority,
        long visibleAtEpochMs
    );

    List<TaskSnapshot> pollTasks(
        String tenantId,
        String taskType,
        String domain,
        int batchSize,
        String workerId,
        long responseTimeoutMs,
        long nowEpochMs
    );

    boolean renewLease(String taskId, String workerId, long newVisibleAtEpochMs);

    void removeQueueTask(String taskId);

    List<TaskSnapshot> findExpiredLeaseTasks(long nowEpochMs);

    // Dead-letter queue (DLQ) operations
    void quarantineTaskToDlq(TaskDlqRecord record);

    List<TaskDlqRecord> listDlqTasks(String tenantId, String status, int limit);

    Optional<TaskDlqRecord> getDlqTask(String dlqId);

    void updateDlqStatus(String dlqId, String status, Long replayedAtMs);

    void deleteDlqTask(String dlqId);

    // Workflow Definition Versioning
    void saveDefinitionVersion(com.unipost.workflow.core.model.WorkflowDefinitionRecord record);

    Optional<com.unipost.workflow.core.model.WorkflowDefinitionRecord> getDefinitionVersion(String tenantId, String workflowKey, int version);

    List<com.unipost.workflow.core.model.WorkflowDefinitionRecord> listDefinitionVersions(String tenantId, String workflowKey);

    void updateDefinitionStatus(String tenantId, String workflowKey, int version, com.unipost.workflow.core.model.WorkflowVersionStatus status, Long publishedAtMs, String publishedBy);

    // In-flight Execution Hot Migration
    void updateWorkflowDefinitionSnapshot(String workflowId, int newVersion, WorkflowDefinition newDefinitionSnapshot, long nowEpochMs);

    // Cryptographic Audit Ledger
    void appendAuditRecord(com.unipost.workflow.core.model.WorkflowAuditRecord record);

    List<com.unipost.workflow.core.model.WorkflowAuditRecord> listAuditRecords(String workflowId);

    Optional<com.unipost.workflow.core.model.WorkflowAuditRecord> getLatestAuditRecord(String workflowId);
}

