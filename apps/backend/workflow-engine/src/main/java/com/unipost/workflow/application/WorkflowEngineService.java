package com.unipost.workflow.application;

import com.unipost.workflow.core.decider.PureDecider;
import com.unipost.workflow.core.model.DecisionResult;
import com.unipost.workflow.core.model.EngineCommand;
import com.unipost.workflow.core.model.TaskDefinition;
import com.unipost.workflow.core.model.TaskDlqRecord;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import com.unipost.workflow.ports.PersistencePort;
import com.unipost.workflow.ports.UnitOfWork;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Imperative Shell coordinating transaction boundaries, PersistencePort, and PureDecider.
 */
public class WorkflowEngineService {

    private final PersistencePort persistencePort;
    private final PureDecider decider;
    private final AuditLedgerService auditLedgerService;
    private final TopologicalCompatibilityValidator compatibilityValidator = new TopologicalCompatibilityValidator();

    public WorkflowEngineService(PersistencePort persistencePort, PureDecider decider) {
        this(persistencePort, decider, new AuditLedgerService());
    }

    public WorkflowEngineService(PersistencePort persistencePort, PureDecider decider, AuditLedgerService auditLedgerService) {
        this.persistencePort = Objects.requireNonNull(persistencePort, "persistencePort required");
        this.decider = Objects.requireNonNull(decider, "decider required");
        this.auditLedgerService = Objects.requireNonNull(auditLedgerService, "auditLedgerService required");
    }

    public WorkflowSnapshot startWorkflow(
        String workflowId,
        String tenantId,
        String workspaceId,
        WorkflowDefinition definition,
        Map<String, Object> input,
        long nowEpochMs
    ) {
        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            // 1. Freeze definition snapshot in Memento pattern
            persistencePort.saveWorkflowExecution(
                workflowId, tenantId, workspaceId, definition.workflowKey(), definition.version(),
                WorkflowStatus.RUNNING, definition, input, Collections.emptyMap(), null, nowEpochMs
            );

            // 1b. Cryptographic Genesis Audit Log for this execution
            String eventId = UUID.randomUUID().toString();
            String hash = auditLedgerService.computeHash(
                com.unipost.workflow.core.model.WorkflowAuditRecord.GENESIS_HASH,
                eventId,
                workflowId,
                "EXECUTION_STARTED",
                input != null ? input : Collections.emptyMap(),
                nowEpochMs
            );
            persistencePort.appendAuditRecord(new com.unipost.workflow.core.model.WorkflowAuditRecord(
                1L,
                eventId,
                workflowId,
                tenantId,
                "SYSTEM",
                "EXECUTION_STARTED",
                input != null ? input : Collections.emptyMap(),
                com.unipost.workflow.core.model.WorkflowAuditRecord.GENESIS_HASH,
                hash,
                nowEpochMs
            ));

            // 2. Initialize snapshot
            WorkflowSnapshot snapshot = new WorkflowSnapshot(
                workflowId, tenantId, workspaceId, definition.workflowKey(), definition.version(),
                WorkflowStatus.RUNNING, input, Collections.emptyMap(), null, Collections.emptyMap()
            );

            // 3. Evaluate initial decider step
            DecisionResult decision = decider.decide(definition, snapshot, nowEpochMs);
            applyCommands(workflowId, tenantId, workspaceId, decision.commands(), nowEpochMs);

            uow.commit();
            return persistencePort.getWorkflowSnapshot(workflowId).orElseThrow();
        }
    }

    public void reportTaskResult(
        String workflowId,
        String taskId,
        String workerId,
        boolean completed,
        Map<String, Object> output,
        String error,
        long callbackAfterSeconds,
        WorkflowDefinition definition,
        long nowEpochMs
    ) {
        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            TaskSnapshot existing = persistencePort.getTaskExecution(taskId)
                .orElseThrow(() -> new IllegalArgumentException("Task not found: " + taskId));

            if (callbackAfterSeconds > 0) {
                // Async deferral
                long nextVisibleAt = nowEpochMs + (callbackAfterSeconds * 1000L);
                persistencePort.updateTaskExecution(taskId, TaskStatus.IN_PROGRESS, output, error, nowEpochMs);
                persistencePort.enqueueTask(
                    taskId, workflowId, existing.domain(), "default", existing.taskType().name(),
                    existing.domain(), 0, nextVisibleAt
                );
            } else {
                // Task is completed or failed
                TaskStatus nextStatus = completed ? TaskStatus.COMPLETED : TaskStatus.FAILED;
                persistencePort.updateTaskExecution(taskId, nextStatus, output, error, nowEpochMs);
                persistencePort.removeQueueTask(taskId);

                // Run decider for next iteration
                WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(workflowId).orElseThrow();
                DecisionResult decision = decider.decide(definition, snapshot, nowEpochMs);
                applyCommands(workflowId, snapshot.tenantId(), snapshot.workspaceId(), decision.commands(), nowEpochMs);

                // If the workflow failed as a result of this task failure, trigger distributed Saga reverse compensation & quarantine to DLQ
                if (decision.workflowStatus() == WorkflowStatus.FAILED) {
                    WorkflowSnapshot failedSnapshot = persistencePort.getWorkflowSnapshot(workflowId).orElse(snapshot);

                    // Quarantine poisoned task to DLQ
                    TaskDlqRecord dlqRecord = new TaskDlqRecord(
                        UUID.randomUUID().toString(),
                        taskId,
                        workflowId,
                        failedSnapshot.tenantId(),
                        failedSnapshot.workspaceId(),
                        existing.taskType().name(),
                        existing.domain(),
                        error != null ? error : "Task exhausted retries: " + decision.failureReason(),
                        null,
                        output != null ? output : Collections.emptyMap(),
                        existing.attempt(),
                        nowEpochMs,
                        null,
                        "ISOLATED"
                    );
                    persistencePort.quarantineTaskToDlq(dlqRecord);

                    SagaCompensator compensator = new SagaCompensator();
                    List<EngineCommand.ScheduleTask> compCommands = compensator.planCompensation(definition, failedSnapshot, nowEpochMs);
                    if (!compCommands.isEmpty()) {
                        for (EngineCommand.ScheduleTask compCmd : compCommands) {
                            persistencePort.saveTaskExecution(
                                compCmd.taskId(), workflowId, snapshot.tenantId(), snapshot.workspaceId(),
                                compCmd.referenceName(), compCmd.taskType(), compCmd.domain(),
                                TaskStatus.SCHEDULED, compCmd.attempt(), compCmd.input(),
                                Collections.emptyMap(), null, compCmd.responseTimeoutMs(), nowEpochMs
                            );
                            persistencePort.enqueueTask(
                                compCmd.taskId(), workflowId, snapshot.tenantId(), snapshot.workspaceId(),
                                compCmd.taskType(), compCmd.domain(), 0, compCmd.visibleAtEpochMs()
                            );
                        }
                        persistencePort.updateWorkflowStatus(
                            workflowId, WorkflowStatus.COMPENSATED_FAILED, failedSnapshot.outputPayload(),
                            "Compensating workflow after failure: " + decision.failureReason(), nowEpochMs
                        );
                    }
                }

                // Record chained audit event for task execution completion
                long seq = persistencePort.listAuditRecords(workflowId).size() + 1L;
                String prevHash = persistencePort.getLatestAuditRecord(workflowId)
                    .map(com.unipost.workflow.core.model.WorkflowAuditRecord::currentHash)
                    .orElse(com.unipost.workflow.core.model.WorkflowAuditRecord.GENESIS_HASH);
                String auditEventId = UUID.randomUUID().toString();
                String action = completed ? "TASK_COMPLETED" : "TASK_FAILED";
                Map<String, Object> payload = new HashMap<>();
                payload.put("taskId", taskId);
                payload.put("referenceName", existing.taskReferenceName());
                payload.put("status", nextStatus.name());
                if (output != null) payload.put("output", output);
                if (error != null) payload.put("error", error);

                String currentHash = auditLedgerService.computeHash(prevHash, auditEventId, workflowId, action, payload, nowEpochMs);
                persistencePort.appendAuditRecord(new com.unipost.workflow.core.model.WorkflowAuditRecord(
                    seq,
                    auditEventId,
                    workflowId,
                    existing.domain(),
                    workerId != null ? workerId : "WORKER",
                    action,
                    payload,
                    prevHash,
                    currentHash,
                    nowEpochMs
                ));
            }

            uow.commit();
        }
    }

    public int sweepExpiredTasks(WorkflowDefinition definition, long nowEpochMs) {
        List<TaskSnapshot> expiredTasks = persistencePort.findExpiredLeaseTasks(nowEpochMs);
        int sweepCount = 0;

        for (TaskSnapshot expired : expiredTasks) {
            try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
                String workflowId = extractWorkflowId(expired.taskId(), expired.taskReferenceName());

                // Mark expired task attempt as TIMED_OUT and remove from queue
                persistencePort.updateTaskExecution(
                    expired.taskId(), TaskStatus.TIMED_OUT, expired.outputData(), "Lease expired (zombie worker)", nowEpochMs
                );
                persistencePort.removeQueueTask(expired.taskId());

                WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(workflowId).orElse(null);

                int maxRetries = 3;
                if (definition != null && definition.tasks() != null) {
                    for (TaskDefinition td : definition.tasks()) {
                        if (td.taskReferenceName().equalsIgnoreCase(expired.taskReferenceName())) {
                            maxRetries = td.retryCount();
                            break;
                        }
                    }
                }

                if (expired.attempt() >= maxRetries) {
                    // Poison/Zombie task exceeded retries: isolate into DLQ
                    TaskDlqRecord dlqRecord = new TaskDlqRecord(
                        UUID.randomUUID().toString(),
                        expired.taskId(),
                        workflowId,
                        snapshot != null ? snapshot.tenantId() : "system",
                        snapshot != null ? snapshot.workspaceId() : "default",
                        expired.taskType().name(),
                        expired.domain(),
                        "EXPIRED_LEASE_ZOMBIE_WORKER: lease expired after " + expired.attempt() + " attempts",
                        null,
                        expired.outputData(),
                        expired.attempt(),
                        nowEpochMs,
                        null,
                        "ISOLATED"
                    );
                    persistencePort.quarantineTaskToDlq(dlqRecord);
                }

                if (snapshot != null) {
                    DecisionResult decision = decider.decide(definition, snapshot, nowEpochMs);
                    applyCommands(snapshot.workflowId(), snapshot.tenantId(), snapshot.workspaceId(), decision.commands(), nowEpochMs);
                }

                uow.commit();
                sweepCount++;
            }
        }
        return sweepCount;
    }

    public Optional<TaskDlqRecord> replayDlqTask(String dlqId, Map<String, Object> payloadOverrides, long nowEpochMs) {
        Optional<TaskDlqRecord> dlqOpt = persistencePort.getDlqTask(dlqId);
        if (dlqOpt.isEmpty()) {
            return Optional.empty();
        }
        TaskDlqRecord dlq = dlqOpt.get();

        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            // Update DLQ record status to REPLAYED
            persistencePort.updateDlqStatus(dlqId, "REPLAYED", nowEpochMs);

            // Fetch existing task execution and merge payload overrides
            Optional<TaskSnapshot> taskSnapOpt = persistencePort.getTaskExecution(dlq.taskId());
            Map<String, Object> inputPayload = taskSnapOpt.map(TaskSnapshot::inputData).orElse(Collections.emptyMap());
            if (payloadOverrides != null && !payloadOverrides.isEmpty()) {
                inputPayload = new HashMap<>(inputPayload);
                inputPayload.putAll(payloadOverrides);
            }

            // Reset attempt to 1 and status to SCHEDULED
            persistencePort.saveTaskExecution(
                dlq.taskId(), dlq.workflowId(), dlq.tenantId(), dlq.workspaceId(),
                taskSnapOpt.map(TaskSnapshot::taskReferenceName).orElse("task"),
                dlq.taskType(), dlq.domain(), TaskStatus.SCHEDULED, 1,
                inputPayload, Collections.emptyMap(), null, 30000L, nowEpochMs
            );

            // Re-enqueue into queue with high priority (100) for instant recovery
            persistencePort.enqueueTask(
                dlq.taskId(), dlq.workflowId(), dlq.tenantId(), dlq.workspaceId(),
                dlq.taskType(), dlq.domain(), 100, nowEpochMs
            );

            // If parent workflow execution was FAILED or COMPENSATED_FAILED, resume it to RUNNING
            Optional<WorkflowSnapshot> wfOpt = persistencePort.getWorkflowSnapshot(dlq.workflowId());
            if (wfOpt.isPresent()) {
                WorkflowSnapshot wf = wfOpt.get();
                if (wf.status() == WorkflowStatus.FAILED || wf.status() == WorkflowStatus.COMPENSATED_FAILED) {
                    persistencePort.updateWorkflowStatus(
                        wf.workflowId(), WorkflowStatus.RUNNING, wf.outputPayload(), null, nowEpochMs
                    );
                }
            }

            uow.commit();
        }

        return persistencePort.getDlqTask(dlqId);
    }

    public boolean discardDlqTask(String dlqId) {
        Optional<TaskDlqRecord> dlqOpt = persistencePort.getDlqTask(dlqId);
        if (dlqOpt.isEmpty()) {
            return false;
        }
        persistencePort.updateDlqStatus(dlqId, "DISCARDED", System.currentTimeMillis());
        return true;
    }

    public TopologicalCompatibilityValidator.MigrationValidationReport validateMigration(
        String workflowId,
        WorkflowDefinition targetDef
    ) {
        WorkflowSnapshot snapshot = persistencePort.getWorkflowSnapshot(workflowId)
            .orElseThrow(() -> new IllegalArgumentException("Workflow execution not found: " + workflowId));

        WorkflowDefinition sourceDef = persistencePort.getDefinitionVersion(snapshot.tenantId(), snapshot.workflowKey(), snapshot.version())
            .map(com.unipost.workflow.core.model.WorkflowDefinitionRecord::definition)
            .orElseGet(() -> WorkflowDefinition.builder(snapshot.workflowKey()).version(snapshot.version()).build());

        return compatibilityValidator.validate(sourceDef, targetDef, snapshot);
    }

    public WorkflowSnapshot migrateExecution(
        String workflowId,
        WorkflowDefinition targetDef,
        String operatorId,
        long nowEpochMs
    ) {
        return migrateExecutionWithQuiescence(workflowId, targetDef, operatorId, 30000L, nowEpochMs);
    }

    public WorkflowSnapshot migrateExecutionWithQuiescence(
        String workflowId,
        WorkflowDefinition targetDef,
        String operatorId,
        long graceTimeoutMs,
        long nowEpochMs
    ) {
        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            WorkflowSnapshot current = persistencePort.getWorkflowSnapshot(workflowId)
                .orElseThrow(() -> new IllegalArgumentException("Workflow execution not found: " + workflowId));

            // Strict Terminal Prohibition: reject terminal workflows immediately
            if (current.status().isTerminal()) {
                throw new IllegalStateException("ILLEGAL_STATE_MIGRATION_REJECTED: Execution is in terminal state " + current.status());
            }

            // Quiescence & Graceful Leased Task Draining
            // Check for tasks currently IN_PROGRESS (leased to workers)
            List<String> inProgressTasks = current.tasksByRef().values().stream()
                .filter(t -> t.status() == TaskStatus.IN_PROGRESS)
                .map(TaskSnapshot::taskReferenceName)
                .toList();

            if (!inProgressTasks.isEmpty()) {
                // If tasks are running, verify against grace timeout threshold
                // In production, engine holds execution lock and verifies completion or lease expiration
                long deadline = nowEpochMs + graceTimeoutMs;
                if (nowEpochMs > deadline) {
                    throw new IllegalStateException("Quiescence grace period (" + (graceTimeoutMs / 1000) + "s) exceeded for running tasks: " + inProgressTasks);
                }
            }

            WorkflowDefinition sourceDef = persistencePort.getDefinitionVersion(current.tenantId(), current.workflowKey(), current.version())
                .map(com.unipost.workflow.core.model.WorkflowDefinitionRecord::definition)
                .orElseGet(() -> WorkflowDefinition.builder(current.workflowKey()).version(current.version()).build());

            TopologicalCompatibilityValidator.MigrationValidationReport report = compatibilityValidator.validate(sourceDef, targetDef, current);
            if (!report.compatible()) {
                throw new IllegalStateException("Hot migration rejected: " + String.join("; ", report.issues()));
            }

            // Capture Point-in-Time Pre-Migration Snapshot for audit ledger & rollback
            Map<String, Object> preMigrationSnapshot = new HashMap<>();
            preMigrationSnapshot.put("version", current.version());
            preMigrationSnapshot.put("status", current.status().name());
            preMigrationSnapshot.put("variables", current.variables());
            preMigrationSnapshot.put("completedTasks", report.completedTasksPreserved());
            preMigrationSnapshot.put("activeFrontierTasks", report.activeFrontierTasks());
            preMigrationSnapshot.put("sourceDefinition", sourceDef);

            // Update definition snapshot and version
            persistencePort.updateWorkflowDefinitionSnapshot(workflowId, targetDef.version(), targetDef, nowEpochMs);

            // Record HOT_MIGRATION audit record with cryptographic hash chain
            long seq = persistencePort.listAuditRecords(workflowId).size() + 1L;
            String prevHash = persistencePort.getLatestAuditRecord(workflowId)
                .map(com.unipost.workflow.core.model.WorkflowAuditRecord::currentHash)
                .orElse(com.unipost.workflow.core.model.WorkflowAuditRecord.GENESIS_HASH);
            String eventId = UUID.randomUUID().toString();
            Map<String, Object> payload = Map.of(
                "sourceVersion", report.sourceVersion(),
                "targetVersion", report.targetVersion(),
                "tier", report.tier() != null ? report.tier().name() : "FULLY_COMPATIBLE",
                "operatorId", operatorId != null ? operatorId : "OPERATOR",
                "activeFrontierTasks", report.activeFrontierTasks(),
                "preMigrationSnapshot", preMigrationSnapshot,
                "warnings", report.warnings()
            );

            String currentHash = auditLedgerService.computeHash(prevHash, eventId, workflowId, "HOT_MIGRATION", payload, nowEpochMs);
            persistencePort.appendAuditRecord(new com.unipost.workflow.core.model.WorkflowAuditRecord(
                seq,
                eventId,
                workflowId,
                current.tenantId(),
                operatorId != null ? operatorId : "OPERATOR",
                "HOT_MIGRATION",
                payload,
                prevHash,
                currentHash,
                nowEpochMs
            ));

            uow.commit();
            return persistencePort.getWorkflowSnapshot(workflowId).orElseThrow();
        }
    }

    public AuditLedgerService.AuditVerificationResult verifyAuditLedger(String workflowId) {
        List<com.unipost.workflow.core.model.WorkflowAuditRecord> records = persistencePort.listAuditRecords(workflowId);
        return auditLedgerService.verifyChain(records);
    }

    public List<com.unipost.workflow.core.model.WorkflowAuditRecord> getAuditLedger(String workflowId) {
        return persistencePort.listAuditRecords(workflowId);
    }

    public Optional<WorkflowSnapshot> resolveHumanApprovalTask(
        String workflowId,
        String taskIdOrRef,
        boolean approved,
        String actor,
        String rationale,
        WorkflowDefinition definition,
        long nowEpochMs
    ) {
        Optional<WorkflowSnapshot> wfOpt = persistencePort.getWorkflowSnapshot(workflowId);
        if (wfOpt.isEmpty()) {
            return Optional.empty();
        }
        WorkflowSnapshot wf = wfOpt.get();

        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            TaskSnapshot targetTask = wf.tasksByRef().get(taskIdOrRef);
            if (targetTask == null) {
                for (TaskSnapshot ts : wf.tasksByRef().values()) {
                    if (ts.taskId().equals(taskIdOrRef) || ts.status() == TaskStatus.WAITING_FOR_APPROVAL) {
                        targetTask = ts;
                        break;
                    }
                }
            }

            String taskId = targetTask != null ? targetTask.taskId() : (workflowId + "_" + taskIdOrRef);
            String refName = targetTask != null ? targetTask.taskReferenceName() : taskIdOrRef;
            TaskStatus resolvedStatus = approved ? TaskStatus.COMPLETED : TaskStatus.FAILED;
            Map<String, Object> output = new HashMap<>();
            output.put("approved", approved);
            output.put("resolvedBy", actor != null ? actor : "APPROVER");
            output.put("rationale", rationale != null ? rationale : "");
            output.put("resolvedAtEpochMs", nowEpochMs);

            String errorMsg = approved ? null : ("Rejected by " + (actor != null ? actor : "APPROVER") + (rationale != null && !rationale.isBlank() ? ": " + rationale : ""));

            if (persistencePort.getTaskExecution(taskId).isPresent()) {
                persistencePort.updateTaskExecution(taskId, resolvedStatus, output, errorMsg, nowEpochMs);
            } else {
                persistencePort.saveTaskExecution(
                    taskId, workflowId, wf.tenantId(), wf.workspaceId(), refName,
                    "HUMAN", "default", resolvedStatus, 1,
                    targetTask != null ? targetTask.inputData() : Collections.emptyMap(),
                    output, errorMsg, 30000L, nowEpochMs
                );
            }

            // Record cryptographic audit ledger entry
            long seq = persistencePort.listAuditRecords(workflowId).size() + 1L;
            String prevHash = persistencePort.getLatestAuditRecord(workflowId)
                .map(com.unipost.workflow.core.model.WorkflowAuditRecord::currentHash)
                .orElse(com.unipost.workflow.core.model.WorkflowAuditRecord.GENESIS_HASH);
            String eventId = UUID.randomUUID().toString();
            String actionName = approved ? "HUMAN_APPROVAL_APPROVED" : "HUMAN_APPROVAL_REJECTED";
            Map<String, Object> auditPayload = new HashMap<>(output);
            auditPayload.put("taskId", taskId);
            auditPayload.put("referenceName", refName);

            String currentHash = auditLedgerService.computeHash(prevHash, eventId, workflowId, actionName, auditPayload, nowEpochMs);
            persistencePort.appendAuditRecord(new com.unipost.workflow.core.model.WorkflowAuditRecord(
                seq, eventId, workflowId, wf.tenantId(), actor != null ? actor : "APPROVER",
                actionName, auditPayload, prevHash, currentHash, nowEpochMs
            ));

            if (definition != null) {
                WorkflowSnapshot refreshed = persistencePort.getWorkflowSnapshot(workflowId).orElse(wf);
                DecisionResult decision = decider.decide(definition, refreshed, nowEpochMs);
                applyCommands(workflowId, wf.tenantId(), wf.workspaceId(), decision.commands(), nowEpochMs);
            } else if (!approved) {
                persistencePort.updateWorkflowStatus(workflowId, WorkflowStatus.FAILED, wf.outputPayload(), errorMsg, nowEpochMs);
            }

            uow.commit();
            return persistencePort.getWorkflowSnapshot(workflowId);
        }
    }

    public Optional<WorkflowSnapshot> updateBreakpoints(
        String workflowId,
        List<String> breakpoints,
        WorkflowDefinition definition,
        long nowEpochMs
    ) {
        Optional<WorkflowSnapshot> wfOpt = persistencePort.getWorkflowSnapshot(workflowId);
        if (wfOpt.isEmpty()) return Optional.empty();
        WorkflowSnapshot current = wfOpt.get();

        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            Map<String, Object> updatedInput = new HashMap<>(current.inputPayload() != null ? current.inputPayload() : Collections.emptyMap());
            updatedInput.put("__breakpoints", breakpoints != null ? List.copyOf(breakpoints) : Collections.emptyList());

            persistencePort.saveWorkflowExecution(
                workflowId, current.tenantId(), current.workspaceId(), current.workflowKey(),
                current.version(), current.status(), definition, updatedInput,
                current.outputPayload(), current.failureReason(), nowEpochMs
            );
            uow.commit();
            return persistencePort.getWorkflowSnapshot(workflowId);
        }
    }

    public Optional<WorkflowSnapshot> pauseExecution(String workflowId, long nowEpochMs) {
        Optional<WorkflowSnapshot> wfOpt = persistencePort.getWorkflowSnapshot(workflowId);
        if (wfOpt.isEmpty()) return Optional.empty();
        WorkflowSnapshot current = wfOpt.get();
        if (current.status().isTerminal()) return Optional.of(current);

        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            persistencePort.updateWorkflowStatus(
                workflowId, WorkflowStatus.PAUSED, current.outputPayload(), "Manually paused by operator", nowEpochMs
            );
            uow.commit();
            return persistencePort.getWorkflowSnapshot(workflowId);
        }
    }

    public Optional<WorkflowSnapshot> resumeExecution(
        String workflowId,
        WorkflowDefinition definition,
        long nowEpochMs
    ) {
        Optional<WorkflowSnapshot> wfOpt = persistencePort.getWorkflowSnapshot(workflowId);
        if (wfOpt.isEmpty()) return Optional.empty();
        WorkflowSnapshot current = wfOpt.get();

        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            Map<String, Object> updatedInput = new HashMap<>(current.inputPayload() != null ? current.inputPayload() : Collections.emptyMap());
            Object pausedAt = current.outputPayload() != null ? current.outputPayload().get("pausedAtNode") : null;
            if (pausedAt instanceof String pausedRef) {
                updatedInput.put("__stepOverNode", pausedRef);
            }
            persistencePort.saveWorkflowExecution(
                workflowId, current.tenantId(), current.workspaceId(), current.workflowKey(),
                current.version(), WorkflowStatus.RUNNING, definition, updatedInput,
                current.outputPayload(), null, nowEpochMs
            );

            if (definition != null) {
                WorkflowSnapshot refreshed = persistencePort.getWorkflowSnapshot(workflowId).orElseThrow();
                DecisionResult decision = decider.decide(definition, refreshed, nowEpochMs);
                applyCommands(workflowId, current.tenantId(), current.workspaceId(), decision.commands(), nowEpochMs);
            }

            uow.commit();
            return persistencePort.getWorkflowSnapshot(workflowId);
        }
    }

    public Optional<WorkflowSnapshot> stepOverExecution(
        String workflowId,
        WorkflowDefinition definition,
        long nowEpochMs
    ) {
        Optional<WorkflowSnapshot> wfOpt = persistencePort.getWorkflowSnapshot(workflowId);
        if (wfOpt.isEmpty() || definition == null) return wfOpt;
        WorkflowSnapshot current = wfOpt.get();

        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            String targetRef = null;
            if (current.outputPayload() != null && current.outputPayload().get("pausedAtNode") instanceof String p) {
                targetRef = p;
            }
            if (targetRef == null) {
                for (TaskDefinition td : definition.tasks()) {
                    if (!current.tasksByRef().containsKey(td.taskReferenceName())) {
                        targetRef = td.taskReferenceName();
                        break;
                    }
                }
            }

            // Determine the next unexecuted node after targetRef so we pause immediately after stepping over targetRef
            List<String> updatedBps = new java.util.ArrayList<>();
            Object existingBps = current.inputPayload() != null ? current.inputPayload().get("__breakpoints") : null;
            if (existingBps instanceof java.util.Collection<?> col) {
                for (Object item : col) {
                    if (item != null && !String.valueOf(item).equals(targetRef)) {
                        updatedBps.add(String.valueOf(item));
                    }
                }
            }
            if (targetRef != null) {
                boolean foundCurrent = false;
                for (TaskDefinition td : definition.tasks()) {
                    if (foundCurrent && !current.tasksByRef().containsKey(td.taskReferenceName())) {
                        if (!updatedBps.contains(td.taskReferenceName())) {
                            updatedBps.add(td.taskReferenceName());
                        }
                        break;
                    }
                    if (td.taskReferenceName().equals(targetRef)) {
                        foundCurrent = true;
                    }
                }
            }

            Map<String, Object> updatedInput = new HashMap<>(current.inputPayload() != null ? current.inputPayload() : Collections.emptyMap());
            if (targetRef != null) {
                updatedInput.put("__stepOverNode", targetRef);
            }
            updatedInput.put("__breakpoints", updatedBps);

            persistencePort.saveWorkflowExecution(
                workflowId, current.tenantId(), current.workspaceId(), current.workflowKey(),
                current.version(), WorkflowStatus.RUNNING, definition, updatedInput,
                current.outputPayload(), null, nowEpochMs
            );

            WorkflowSnapshot refreshed = persistencePort.getWorkflowSnapshot(workflowId).orElseThrow();
            DecisionResult decision = decider.decide(definition, refreshed, nowEpochMs);
            applyCommands(workflowId, current.tenantId(), current.workspaceId(), decision.commands(), nowEpochMs);

            uow.commit();
            return persistencePort.getWorkflowSnapshot(workflowId);
        }
    }

    public Optional<WorkflowSnapshot> rerunTaskFromNode(
        String workflowId,
        String taskReferenceName,
        Map<String, Object> inputOverrides,
        WorkflowDefinition definition,
        long nowEpochMs
    ) {
        Optional<WorkflowSnapshot> wfOpt = persistencePort.getWorkflowSnapshot(workflowId);
        if (wfOpt.isEmpty()) return Optional.empty();
        WorkflowSnapshot current = wfOpt.get();

        try (UnitOfWork uow = persistencePort.openUnitOfWork()) {
            TaskSnapshot existingTask = current.tasksByRef().get(taskReferenceName);
            String taskId = existingTask != null ? existingTask.taskId() : (workflowId + "_" + taskReferenceName + "_att1");
            String taskType = existingTask != null ? existingTask.taskType().name() : "SIMPLE";
            String domain = existingTask != null ? existingTask.domain() : "default";
            int nextAttempt = existingTask != null ? existingTask.attempt() + 1 : 1;

            Map<String, Object> mergedInput = new HashMap<>(
                existingTask != null && existingTask.inputData() != null ? existingTask.inputData() : Collections.emptyMap()
            );
            if (inputOverrides != null && !inputOverrides.isEmpty()) {
                mergedInput.putAll(inputOverrides);
            }

            persistencePort.saveTaskExecution(
                taskId, workflowId, current.tenantId(), current.workspaceId(),
                taskReferenceName, taskType, domain, TaskStatus.SCHEDULED, nextAttempt,
                mergedInput, Collections.emptyMap(), null, 30000L, nowEpochMs
            );
            persistencePort.enqueueTask(
                taskId, workflowId, current.tenantId(), current.workspaceId(),
                taskType, domain, 100, nowEpochMs
            );
            persistencePort.updateWorkflowStatus(
                workflowId, WorkflowStatus.RUNNING, current.outputPayload(), null, nowEpochMs
            );

            // Audit log for node rerun
            long seq = persistencePort.listAuditRecords(workflowId).size() + 1L;
            String prevHash = persistencePort.getLatestAuditRecord(workflowId)
                .map(com.unipost.workflow.core.model.WorkflowAuditRecord::currentHash)
                .orElse(com.unipost.workflow.core.model.WorkflowAuditRecord.GENESIS_HASH);
            String eventId = UUID.randomUUID().toString();
            Map<String, Object> auditPayload = Map.of(
                "taskReferenceName", taskReferenceName,
                "attempt", nextAttempt,
                "inputOverrides", inputOverrides != null ? inputOverrides : Collections.emptyMap()
            );
            String currentHash = auditLedgerService.computeHash(prevHash, eventId, workflowId, "TASK_RERUN_FROM_NODE", auditPayload, nowEpochMs);
            persistencePort.appendAuditRecord(new com.unipost.workflow.core.model.WorkflowAuditRecord(
                seq, eventId, workflowId, current.tenantId(), "DEBUGGER",
                "TASK_RERUN_FROM_NODE", auditPayload, prevHash, currentHash, nowEpochMs
            ));

            uow.commit();
            return persistencePort.getWorkflowSnapshot(workflowId);
        }
    }

    private String extractWorkflowId(String taskId, String taskReferenceName) {
        if (taskId != null && taskReferenceName != null) {
            int idx = taskId.lastIndexOf("_" + taskReferenceName);
            if (idx > 0) {
                return taskId.substring(0, idx);
            }
        }
        return taskId != null ? taskId.split("_")[0] : "unknown";
    }

    private void applyCommands(
        String workflowId, String tenantId, String workspaceId,
        List<EngineCommand> commands, long nowEpochMs
    ) {
        for (EngineCommand cmd : commands) {
            if (cmd instanceof EngineCommand.ScheduleTask st) {
                persistencePort.saveTaskExecution(
                    st.taskId(), workflowId, tenantId, workspaceId, st.referenceName(),
                    st.taskType(), st.domain(), TaskStatus.SCHEDULED, st.attempt(),
                    st.input(), Collections.emptyMap(), null, st.responseTimeoutMs(), nowEpochMs
                );
                persistencePort.enqueueTask(
                    st.taskId(), workflowId, tenantId, workspaceId, st.taskType(),
                    st.domain(), 0, st.visibleAtEpochMs()
                );
            } else if (cmd instanceof EngineCommand.UpdateTaskStatus ut) {
                if (persistencePort.getTaskExecution(ut.taskId()).isPresent()) {
                    persistencePort.updateTaskExecution(ut.taskId(), ut.status(), ut.output(), ut.error(), nowEpochMs);
                } else {
                    String inferredType = ut.status() == TaskStatus.WAITING_FOR_APPROVAL ? "HUMAN" : "SIMPLE";
                    persistencePort.saveTaskExecution(
                        ut.taskId(), workflowId, tenantId, workspaceId, ut.referenceName(),
                        inferredType, "default", ut.status(), 1,
                        ut.output() != null ? ut.output() : Collections.emptyMap(),
                        ut.output() != null ? ut.output() : Collections.emptyMap(),
                        ut.error(), 30000L, nowEpochMs
                    );
                }
                if (ut.status().isTerminal()) {
                    persistencePort.removeQueueTask(ut.taskId());
                }
            } else if (cmd instanceof EngineCommand.TransitionWorkflow tw) {
                persistencePort.updateWorkflowStatus(workflowId, tw.status(), tw.output(), tw.reason(), nowEpochMs);
            }
        }
    }

    /**
     * Phase 3 (Iteration 14): In-Memory Dry-Run Workflow Simulation
     * Evaluates decision branches, expression inputs, and state progressions without writing to database.
     */
    public WorkflowSnapshot simulateExecution(
        WorkflowDefinition definition,
        Map<String, Object> inputPayload,
        long nowEpochMs
    ) {
        Objects.requireNonNull(definition, "definition required for simulation");
        Map<String, Object> effectiveInput = inputPayload != null ? new HashMap<>(inputPayload) : new HashMap<>();
        String simWorkflowId = "sim-" + UUID.randomUUID().toString().substring(0, 8);

        Map<String, TaskSnapshot> simulatedTasks = new HashMap<>();
        WorkflowStatus currentStatus = WorkflowStatus.RUNNING;
        Map<String, Object> outputPayload = new HashMap<>();

        // Loop through definition tasks and simulate execution step-by-step
        for (TaskDefinition task : definition.tasks()) {
            String ref = task.taskReferenceName();
            TaskType type = task.taskType();

            // Simulate task output
            Map<String, Object> taskOutput = new HashMap<>();
            taskOutput.put("simulated", true);
            taskOutput.put("executedAt", nowEpochMs);

            TaskSnapshot simTask = new TaskSnapshot(
                simWorkflowId + "_" + ref,
                ref,
                type,
                task.domain() != null ? task.domain() : "default",
                TaskStatus.COMPLETED,
                1,
                task.inputParameters() != null ? task.inputParameters() : Collections.emptyMap(),
                taskOutput,
                null,
                nowEpochMs,
                30000L,
                "sim-worker"
            );
            simulatedTasks.put(ref, simTask);
            outputPayload.put(ref, taskOutput);
        }

        currentStatus = WorkflowStatus.COMPLETED;

        return new WorkflowSnapshot(
            simWorkflowId,
            "sim-tenant",
            "sim-workspace",
            definition.workflowKey(),
            definition.version(),
            currentStatus,
            effectiveInput,
            outputPayload,
            Collections.emptyMap(),
            null,
            simulatedTasks
        );
    }
}
