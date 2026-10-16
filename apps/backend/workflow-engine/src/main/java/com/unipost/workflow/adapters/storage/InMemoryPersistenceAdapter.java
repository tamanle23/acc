package com.unipost.workflow.adapters.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.unipost.workflow.core.model.TaskDlqRecord;
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
    private final Map<String, TaskDlqRecord> dlq = new ConcurrentHashMap<>();
    private final Map<String, com.unipost.workflow.core.model.WorkflowDefinitionRecord> definitions = new ConcurrentHashMap<>();
    private final Map<String, List<com.unipost.workflow.core.model.WorkflowAuditRecord>> auditLogs = new ConcurrentHashMap<>();

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
        String taskType, String domain, int priority, long visibleAtEpochMs, String leaseOwner,
        long createdAtMs
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
    public List<WorkflowSnapshot> listWorkflowExecutions(String tenantId, String workflowKey, WorkflowStatus status) {
        lock.lock();
        try {
            List<WorkflowSnapshot> result = new ArrayList<>();
            for (WorkflowRecord rec : workflows.values()) {
                if (tenantId != null && !tenantId.isBlank() && !rec.tenantId().equals(tenantId) && !"system".equals(tenantId)) {
                    continue;
                }
                if (workflowKey != null && !workflowKey.isBlank() && !rec.workflowName().equals(workflowKey)) {
                    continue;
                }
                if (status != null && rec.status() != status) {
                    continue;
                }

                Map<String, TaskSnapshot> tasksByRef = new HashMap<>();
                for (TaskRecord tr : tasks.values()) {
                    if (tr.workflowId().equals(rec.workflowId())) {
                        tasksByRef.put(tr.referenceName(), toTaskSnapshot(tr));
                    }
                }
                Map<String, Object> in = fromJson(rec.inputJson(), Map.class);
                Map<String, Object> out = fromJson(rec.outputJson(), Map.class);
                result.add(new WorkflowSnapshot(
                    rec.workflowId(), rec.tenantId(), rec.workspaceId(), rec.workflowName(),
                    rec.version(), rec.status(), in, out, rec.failureReason(), tasksByRef
                ));
            }
            return Collections.unmodifiableList(result);
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
            long createdAtMs = System.currentTimeMillis();
            queue.put(taskId, new QueueRecord(
                taskId, workflowId, tenantId, workspaceId, taskType, domain, priority, visibleAtEpochMs, null, createdAtMs
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

            // Anti-starvation dynamic priority aging (+1 priority per 5 seconds in queue)
            candidates.sort(Comparator.<QueueRecord>comparingInt(qr -> qr.priority() + (int) Math.max(0, (nowEpochMs - qr.createdAtMs()) / 5000L))
                .reversed()
                .thenComparingLong(QueueRecord::visibleAtEpochMs));

            List<TaskSnapshot> result = new ArrayList<>();
            int count = Math.min(batchSize, candidates.size());

            for (int i = 0; i < count; i++) {
                QueueRecord qr = candidates.get(i);
                long newVisibleAt = nowEpochMs + responseTimeoutMs;
                queue.put(qr.taskId(), new QueueRecord(
                    qr.taskId(), qr.workflowId(), qr.tenantId(), qr.workspaceId(),
                    qr.taskType(), qr.domain(), qr.priority(), newVisibleAt, workerId, qr.createdAtMs()
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
                    qr.taskType(), qr.domain(), qr.priority(), newVisibleAtEpochMs, workerId, qr.createdAtMs()
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

    @Override
    public void quarantineTaskToDlq(TaskDlqRecord record) {
        lock.lock();
        try {
            dlq.put(record.dlqId(), record);
            queue.remove(record.taskId());
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<TaskDlqRecord> listDlqTasks(String tenantId, String status, int limit) {
        lock.lock();
        try {
            return dlq.values().stream()
                .filter(r -> tenantId == null || tenantId.isBlank() || r.tenantId().equalsIgnoreCase(tenantId))
                .filter(r -> status == null || status.isBlank() || r.status().equalsIgnoreCase(status))
                .sorted(Comparator.comparingLong(TaskDlqRecord::isolatedAtMs).reversed())
                .limit(limit > 0 ? limit : 100)
                .toList();
        } finally {
            lock.unlock();
        }
    }

    @Override
    public Optional<TaskDlqRecord> getDlqTask(String dlqId) {
        lock.lock();
        try {
            return Optional.ofNullable(dlq.get(dlqId));
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void updateDlqStatus(String dlqId, String status, Long replayedAtMs) {
        lock.lock();
        try {
            TaskDlqRecord existing = dlq.get(dlqId);
            if (existing != null) {
                TaskDlqRecord updated = new TaskDlqRecord(
                    existing.dlqId(), existing.taskId(), existing.workflowId(), existing.tenantId(),
                    existing.workspaceId(), existing.taskType(), existing.domain(),
                    existing.errorMessage(), existing.errorStacktrace(), existing.payloadSnapshot(),
                    existing.retryCount(), existing.isolatedAtMs(), replayedAtMs, status
                );
                dlq.put(dlqId, updated);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void deleteDlqTask(String dlqId) {
        lock.lock();
        try {
            dlq.remove(dlqId);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void saveDefinitionVersion(com.unipost.workflow.core.model.WorkflowDefinitionRecord record) {
        lock.lock();
        try {
            String key = record.tenantId() + ":" + record.workflowKey() + ":" + record.version();
            definitions.put(key, record);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public Optional<com.unipost.workflow.core.model.WorkflowDefinitionRecord> getDefinitionVersion(String tenantId, String workflowKey, int version) {
        String key = (tenantId != null ? tenantId : "system") + ":" + workflowKey + ":" + version;
        com.unipost.workflow.core.model.WorkflowDefinitionRecord rec = definitions.get(key);
        if (rec != null) return Optional.of(rec);
        // Fallback to system
        String sysKey = "system:" + workflowKey + ":" + version;
        return Optional.ofNullable(definitions.get(sysKey));
    }

    @Override
    public List<com.unipost.workflow.core.model.WorkflowDefinitionRecord> listDefinitionVersions(String tenantId, String workflowKey) {
        String prefix = (tenantId != null ? tenantId : "system") + ":" + workflowKey + ":";
        List<com.unipost.workflow.core.model.WorkflowDefinitionRecord> list = new ArrayList<>();
        for (Map.Entry<String, com.unipost.workflow.core.model.WorkflowDefinitionRecord> entry : definitions.entrySet()) {
            if (entry.getKey().startsWith(prefix)) {
                list.add(entry.getValue());
            }
        }
        if (list.isEmpty() && !"system".equals(tenantId)) {
            String sysPrefix = "system:" + workflowKey + ":";
            for (Map.Entry<String, com.unipost.workflow.core.model.WorkflowDefinitionRecord> entry : definitions.entrySet()) {
                if (entry.getKey().startsWith(sysPrefix)) {
                    list.add(entry.getValue());
                }
            }
        }
        list.sort(Comparator.comparingInt(com.unipost.workflow.core.model.WorkflowDefinitionRecord::version));
        return list;
    }

    @Override
    public void updateDefinitionStatus(
        String tenantId,
        String workflowKey,
        int version,
        com.unipost.workflow.core.model.WorkflowVersionStatus status,
        Long publishedAtMs,
        String publishedBy
    ) {
        lock.lock();
        try {
            String key = (tenantId != null ? tenantId : "system") + ":" + workflowKey + ":" + version;
            com.unipost.workflow.core.model.WorkflowDefinitionRecord existing = definitions.get(key);
            if (existing != null) {
                com.unipost.workflow.core.model.WorkflowDefinitionRecord updated = new com.unipost.workflow.core.model.WorkflowDefinitionRecord(
                    existing.definitionId(),
                    existing.tenantId(),
                    existing.workflowKey(),
                    existing.version(),
                    status,
                    existing.name(),
                    existing.description(),
                    existing.definition(),
                    publishedAtMs != null ? publishedAtMs : existing.publishedAtMs(),
                    publishedBy != null ? publishedBy : existing.publishedBy(),
                    existing.createdAtMs(),
                    System.currentTimeMillis()
                );
                definitions.put(key, updated);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void updateWorkflowDefinitionSnapshot(String workflowId, int newVersion, WorkflowDefinition newDefinitionSnapshot, long nowEpochMs) {
        lock.lock();
        try {
            WorkflowRecord existing = workflows.get(workflowId);
            if (existing != null) {
                WorkflowRecord updated = new WorkflowRecord(
                    existing.workflowId(),
                    existing.tenantId(),
                    existing.workspaceId(),
                    existing.workflowName(),
                    newVersion,
                    existing.status(),
                    toJson(newDefinitionSnapshot),
                    existing.inputJson(),
                    existing.outputJson(),
                    existing.failureReason(),
                    existing.createdAtMs(),
                    nowEpochMs
                );
                workflows.put(workflowId, updated);
            }
        } finally {
            lock.unlock();
        }
    }

    @Override
    public void appendAuditRecord(com.unipost.workflow.core.model.WorkflowAuditRecord record) {
        lock.lock();
        try {
            List<com.unipost.workflow.core.model.WorkflowAuditRecord> list = auditLogs.computeIfAbsent(
                record.workflowId(),
                k -> Collections.synchronizedList(new ArrayList<>())
            );
            list.add(record);
        } finally {
            lock.unlock();
        }
    }

    @Override
    public List<com.unipost.workflow.core.model.WorkflowAuditRecord> listAuditRecords(String workflowId) {
        List<com.unipost.workflow.core.model.WorkflowAuditRecord> list = auditLogs.get(workflowId);
        if (list == null) return Collections.emptyList();
        return new ArrayList<>(list);
    }

    @Override
    public Optional<com.unipost.workflow.core.model.WorkflowAuditRecord> getLatestAuditRecord(String workflowId) {
        List<com.unipost.workflow.core.model.WorkflowAuditRecord> list = auditLogs.get(workflowId);
        if (list == null || list.isEmpty()) return Optional.empty();
        return Optional.of(list.get(list.size() - 1));
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
