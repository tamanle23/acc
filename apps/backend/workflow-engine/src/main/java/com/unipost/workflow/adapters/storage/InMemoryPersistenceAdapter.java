package com.unipost.workflow.adapters.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.unipost.workflow.core.model.TaskSnapshot;
import com.unipost.workflow.core.model.TaskStatus;
import com.unipost.workflow.core.model.TaskType;
import com.unipost.workflow.core.model.WorkflowDefinition;
import com.unipost.workflow.core.model.WorkflowSnapshot;
import com.unipost.workflow.core.model.WorkflowStatus;
import com.unipost.workflow.ports.PersistencePort;
import com.unipost.workflow.ports.UnitOfWork;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.locks.ReentrantLock;

/**
 * Thread-safe In-Memory Persistence Adapter for fast, deterministic unit and integration tests.
 */
public final class InMemoryPersistenceAdapter implements PersistencePort {

    private final ReentrantLock lock = new ReentrantLock();
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    // In-memory tables
    private final Map<String, WorkflowRecord> workflows = new ConcurrentHashMap<>();
    private final Map<String, TaskRecord> tasks = new ConcurrentHashMap<>();
    private final Map<String, QueueRecord> queue = new ConcurrentHashMap<>();

    private record WorkflowRecord(
        String workflowId, String tenantId, String workspaceId, String workflowName,
        int version, WorkflowStatus status, String definitionJson, String inputJson,
        String outputJson, String failureReason, long createdAtMs, long updatedAtMs
    ) {}

    private record TaskRecord(
        String taskId, String workflowId, String tenantId, String workspaceId,
        String referenceName, String taskType, String domain, TaskStatus status,
        int attempt, String workerId, String inputJson, String outputJson,
        String errorDetails, long responseTimeoutMs, long createdAtMs, long updatedAtMs
    ) {}

    private record QueueRecord(
        String taskId, String workflowId, String tenantId, String workspaceId,
        String taskType, String domain, int priority, long visibleAtEpochMs, String leaseOwner
    ) {}

    @Override
    public UnitOfWork openUnitOfWork() {
        return new UnitOfWork() {
            @Override
            public void commit() {}
            @Override
            public void rollback() {}
            @Override
            public void close() {}
        };
    }

    @Override
    public void saveWorkflowExecution(
        String workflowId, String tenantId, String workspaceId, String workflowName,
        int version, WorkflowStatus status, WorkflowDefinition definitionSnapshot,
        Map<String, Object> inputPayload, Map<String, Object> outputPayload,
        String failureReason, long nowEpochMs
    ) {
        lock.lock();
        try {
            String defJson = toJson(definitionSnapshot);
            String inJson = toJson(inputPayload);
            String outJson = toJson(outputPayload);
            workflows.put(workflowId, new WorkflowRecord(
                workflowId, tenantId, workspaceId, workflowName, version, status,
                defJson, inJson, outJson, failureReason, nowEpochMs, nowEpochMs
            ));
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void updateWorkflowStatus(
        String workflowId, WorkflowStatus status, Map<String, Object> outputPayload,
        String failureReason, long nowEpochMs
    ) {
        lock.lock();
        try {
            WorkflowRecord existing = workflows.get(workflowId);
            if (existing != null) {
                String outJson = outputPayload != null ? toJson(outputPayload) : existing.outputJson();
                workflows.put(workflowId, new WorkflowRecord(
                    existing.workflowId(), existing.tenantId(), existing.workspaceId(), existing.workflowName(),
                    existing.version(), status, existing.definitionJson(), existing.inputJson(),
                    outJson, failureReason != null ? failureReason : existing.failureReason(),
                    existing.createdAtMs(), nowEpochMs
                ));
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public Optional<WorkflowSnapshot> getWorkflowSnapshot(String workflowId) {
        lock.lock();
        try {
            WorkflowRecord rec = workflows.get(workflowId);
            if (rec == null) {
                return Optional.empty();
            }

            Map<String, TaskSnapshot> tasksByRef = new HashMap<>();
            for (TaskRecord tr : tasks.values()) {
                if (tr.workflowId().equals(workflowId)) {
                    tasksByRef.put(tr.referenceName(), toTaskSnapshot(tr));
                }
            }

            Map<String, Object> in = fromJson(rec.inputJson(), Map.class);
            Map<String, Object> out = fromJson(rec.outputJson(), Map.class);

            return Optional.of(new WorkflowSnapshot(
                rec.workflowId(), rec.tenantId(), rec.workspaceId(), rec.workflowName(),
                rec.version(), rec.status(), in, out, rec.failureReason(), tasksByRef
            ));
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void saveTaskExecution(
        String taskId, String workflowId, String tenantId, String workspaceId,
        String referenceName, String taskType, String domain, TaskStatus status,
        int attempt, Map<String, Object> inputPayload, Map<String, Object> outputPayload,
        String errorDetails, long responseTimeoutMs, long nowEpochMs
    ) {
        lock.lock();
        try {
            tasks.put(taskId, new TaskRecord(
                taskId, workflowId, tenantId, workspaceId, referenceName, taskType, domain,
                status, attempt, null, toJson(inputPayload), toJson(outputPayload),
                errorDetails, responseTimeoutMs, nowEpochMs, nowEpochMs
            ));
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void updateTaskExecution(
        String taskId, TaskStatus status, Map<String, Object> outputPayload,
        String errorDetails, long nowEpochMs
    ) {
        lock.lock();
        try {
            TaskRecord existing = tasks.get(taskId);
            if (existing != null) {
                tasks.put(taskId, new TaskRecord(
                    existing.taskId(), existing.workflowId(), existing.tenantId(), existing.workspaceId(),
                    existing.referenceName(), existing.taskType(), existing.domain(), status,
                    existing.attempt(), existing.workerId(), existing.inputJson(),
                    outputPayload != null ? toJson(outputPayload) : existing.outputJson(),
                    errorDetails != null ? errorDetails : existing.errorDetails(),
                    existing.responseTimeoutMs(), existing.createdAtMs(), nowEpochMs
                ));
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public Optional<TaskSnapshot> getTaskExecution(String taskId) {
        lock.lock();
        try {
            TaskRecord tr = tasks.get(taskId);
            return tr != null ? Optional.of(toTaskSnapshot(tr)) : Optional.empty();
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void enqueueTask(
        String taskId, String workflowId, String tenantId, String workspaceId,
        String taskType, String domain, int priority, long visibleAtEpochMs
    ) {
        lock.lock();
        try {
            queue.put(taskId, new QueueRecord(
                taskId, workflowId, tenantId, workspaceId, taskType, domain, priority, visibleAtEpochMs, null
            ));
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<TaskSnapshot> pollTasks(
        String tenantId, String taskType, String domain, int batchSize,
        String workerId, long responseTimeoutMs, long nowEpochMs
    ) {
        lock.lock();
        try {
            List<QueueRecord> candidates = new ArrayList<>();
            for (QueueRecord qr : queue.values()) {
                if (qr.tenantId().equals(tenantId) &&
                    qr.taskType().equalsIgnoreCase(taskType) &&
                    qr.domain().equalsIgnoreCase(domain) &&
                    qr.visibleAtEpochMs() <= nowEpochMs) {
                    candidates.add(qr);
                }
            }

            candidates.sort(Comparator.comparingInt(QueueRecord::priority).reversed()
                .thenComparingLong(QueueRecord::visibleAtEpochMs));

            List<TaskSnapshot> result = new ArrayList<>();
            int count = Math.min(batchSize, candidates.size());

            for (int i = 0; i < count; i++) {
                QueueRecord qr = candidates.get(i);
                long newVisibleAt = nowEpochMs + responseTimeoutMs;
                queue.put(qr.taskId(), new QueueRecord(
                    qr.taskId(), qr.workflowId(), qr.tenantId(), qr.workspaceId(),
                    qr.taskType(), qr.domain(), qr.priority(), newVisibleAt, workerId
                ));

                TaskRecord tr = tasks.get(qr.taskId());
                if (tr != null) {
                    tasks.put(qr.taskId(), new TaskRecord(
                        tr.taskId(), tr.workflowId(), tr.tenantId(), tr.workspaceId(),
                        tr.referenceName(), tr.taskType(), tr.domain(), TaskStatus.IN_PROGRESS,
                        tr.attempt(), workerId, tr.inputJson(), tr.outputJson(),
                        tr.errorDetails(), tr.responseTimeoutMs(), tr.createdAtMs(), nowEpochMs
                    ));
                    result.add(toTaskSnapshot(tasks.get(qr.taskId())));
                }
            }

            return Collections.unmodifiableList(result);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public boolean renewLease(String taskId, String workerId, long newVisibleAtEpochMs) {
        lock.lock();
        try {
            QueueRecord qr = queue.get(taskId);
            if (qr != null && (qr.leaseOwner() == null || qr.leaseOwner().equals(workerId))) {
                queue.put(taskId, new QueueRecord(
                    qr.taskId(), qr.workflowId(), qr.tenantId(), qr.workspaceId(),
                    qr.taskType(), qr.domain(), qr.priority(), newVisibleAtEpochMs, workerId
                ));
                return true;
            }
            return false;
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void removeQueueTask(String taskId) {
        lock.lock();
        try {
            queue.remove(taskId);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<TaskSnapshot> findExpiredLeaseTasks(long nowEpochMs) {
        lock.lock();
        try {
            List<TaskSnapshot> expired = new ArrayList<>();
            for (QueueRecord qr : queue.values()) {
                if (qr.leaseOwner() != null && qr.visibleAtEpochMs() <= nowEpochMs) {
                    TaskRecord tr = tasks.get(qr.taskId());
                    if (tr != null && tr.status() == TaskStatus.IN_PROGRESS) {
                        expired.add(toTaskSnapshot(tr));
                    }
                }
            }
            return Collections.unmodifiableList(expired);
        } finally {
            lock.unlock();
        }
    }

    private TaskSnapshot toTaskSnapshot(TaskRecord tr) {
        TaskType type;
        try {
            type = TaskType.valueOf(tr.taskType().toUpperCase());
        } catch (Exception e) {
            type = TaskType.SIMPLE;
        }
        Map<String, Object> in = fromJson(tr.inputJson(), Map.class);
        Map<String, Object> out = fromJson(tr.outputJson(), Map.class);
        return new TaskSnapshot(
            tr.taskId(), tr.referenceName(), type, tr.domain(), tr.status(),
            tr.attempt(), in, out, tr.errorDetails(), 0L, tr.responseTimeoutMs(), tr.workerId()
        );
    }

    private String toJson(Object obj) {
        if (obj == null) return "{}";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException("JSON serialization failed", e);
        }
    }

    @SuppressWarnings("unchecked")
    private <T> T fromJson(String json, Class<T> clazz) {
        if (json == null || json.isBlank() || "null".equals(json)) return (T) Collections.emptyMap();
        try {
            return objectMapper.readValue(json, clazz);
        } catch (Exception e) {
            return (T) Collections.emptyMap();
        }
    }
}
