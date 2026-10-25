package com.acc.workflow.adapters.storage;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.acc.workflow.core.model.TaskDlqRecord;
import com.acc.workflow.core.model.TaskSnapshot;
import com.acc.workflow.core.model.TaskStatus;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import com.acc.workflow.ports.PersistencePort;
import com.acc.workflow.ports.UnitOfWork;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * PostgreSQL JDBC Persistence Adapter.
 * Employs multi-tenant partitioning and `FOR UPDATE SKIP LOCKED` for zero-contention atomic polling.
 */
public final class PostgresJdbcPersistenceAdapter implements PersistencePort {

    private final DataSource dataSource;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    public PostgresJdbcPersistenceAdapter(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    private Connection getConnection() throws SQLException {
        return dataSource.getConnection();
    }

    @Override
    public UnitOfWork openUnitOfWork() {
        try {
            Connection conn = getConnection();
            conn.setAutoCommit(false);
            return new UnitOfWork() {
                @Override
                public void commit() {
                    try {
                        conn.commit();
                    } catch (SQLException e) {
                        throw new RuntimeException(e);
                    }
                }
                @Override
                public void rollback() {
                    try {
                        conn.rollback();
                    } catch (SQLException e) {
                        throw new RuntimeException(e);
                    }
                }
                @Override
                public void close() {
                    try {
                        if (!conn.isClosed()) conn.close();
                    } catch (SQLException ignored) {}
                }
            };
        } catch (SQLException e) {
            throw new RuntimeException("Failed to open UnitOfWork", e);
        }
    }

    @Override
    public void saveWorkflowExecution(
        String workflowId, String tenantId, String workspaceId, String workflowName,
        int version, WorkflowStatus status, WorkflowDefinition definitionSnapshot,
        Map<String, Object> inputPayload, Map<String, Object> outputPayload,
        String failureReason, long nowEpochMs
    ) {
        String sql = """
            INSERT INTO workflow_executions 
            (workflow_id, tenant_id, workspace_id, workflow_name, version, status, definition_snapshot, input_payload, output_payload, failure_reason, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?)
            ON CONFLICT (workflow_id) DO UPDATE SET
            status = EXCLUDED.status, output_payload = EXCLUDED.output_payload, failure_reason = EXCLUDED.failure_reason, updated_at_ms = EXCLUDED.updated_at_ms
            """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, workflowId);
            ps.setString(2, tenantId);
            ps.setString(3, workspaceId);
            ps.setString(4, workflowName);
            ps.setInt(5, version);
            ps.setString(6, status.name());
            ps.setString(7, toJson(definitionSnapshot));
            ps.setString(8, toJson(inputPayload));
            ps.setString(9, toJson(outputPayload));
            ps.setString(10, failureReason);
            ps.setLong(11, nowEpochMs);
            ps.setLong(12, nowEpochMs);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to save workflow execution in PostgreSQL", e);
        }
    }

    @Override
    public void updateWorkflowStatus(
        String workflowId, WorkflowStatus status, Map<String, Object> outputPayload,
        String failureReason, long nowEpochMs
    ) {
        String sql = "UPDATE workflow_executions SET status = ?, output_payload = ?::jsonb, failure_reason = ?, updated_at_ms = ? WHERE workflow_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            ps.setString(2, toJson(outputPayload));
            ps.setString(3, failureReason);
            ps.setLong(4, nowEpochMs);
            ps.setString(5, workflowId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update workflow status in PostgreSQL", e);
        }
    }

    @Override
    public Optional<WorkflowSnapshot> getWorkflowSnapshot(String workflowId) {
        String sqlWf = "SELECT * FROM workflow_executions WHERE workflow_id = ?";
        String sqlTasks = "SELECT * FROM task_executions WHERE workflow_id = ?";

        try (Connection conn = getConnection();
             PreparedStatement psWf = conn.prepareStatement(sqlWf);
             PreparedStatement psTasks = conn.prepareStatement(sqlTasks)) {

            psWf.setString(1, workflowId);
            try (ResultSet rsWf = psWf.executeQuery()) {
                if (!rsWf.next()) return Optional.empty();

                String tenantId = rsWf.getString("tenant_id");
                String workspaceId = rsWf.getString("workspace_id");
                String name = rsWf.getString("workflow_name");
                int version = rsWf.getInt("version");
                WorkflowStatus status = WorkflowStatus.valueOf(rsWf.getString("status"));
                Map<String, Object> input = fromJson(rsWf.getString("input_payload"));
                Map<String, Object> output = fromJson(rsWf.getString("output_payload"));
                String failure = rsWf.getString("failure_reason");

                Map<String, TaskSnapshot> tasksByRef = new HashMap<>();
                psTasks.setString(1, workflowId);
                try (ResultSet rsTasks = psTasks.executeQuery()) {
                    while (rsTasks.next()) {
                        TaskSnapshot snap = mapTaskSnapshot(rsTasks);
                        tasksByRef.put(snap.taskReferenceName(), snap);
                    }
                }

                return Optional.of(new WorkflowSnapshot(
                    workflowId, tenantId, workspaceId, name, version, status, input, output, failure, tasksByRef
                ));
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to get workflow snapshot from PostgreSQL", e);
        }
    }

    @Override
    public List<WorkflowSnapshot> listWorkflowExecutions(String tenantId, String workflowKey, WorkflowStatus status) {
        StringBuilder sql = new StringBuilder("SELECT * FROM workflow_executions WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (tenantId != null && !tenantId.isBlank() && !"system".equals(tenantId)) {
            sql.append(" AND tenant_id = ?");
            params.add(tenantId);
        }
        if (workflowKey != null && !workflowKey.isBlank()) {
            sql.append(" AND workflow_name = ?");
            params.add(workflowKey);
        }
        if (status != null) {
            sql.append(" AND status = ?");
            params.add(status.name());
        }
        sql.append(" ORDER BY created_at_ms DESC");

        List<WorkflowSnapshot> list = new ArrayList<>();
        try (Connection conn = getConnection();
             PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                ps.setObject(i + 1, params.get(i));
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    String wfId = rs.getString("workflow_id");
                    String tId = rs.getString("tenant_id");
                    String wsId = rs.getString("workspace_id");
                    String name = rs.getString("workflow_name");
                    int version = rs.getInt("version");
                    WorkflowStatus st = WorkflowStatus.valueOf(rs.getString("status"));
                    Map<String, Object> input = fromJson(rs.getString("input_payload"));
                    Map<String, Object> output = fromJson(rs.getString("output_payload"));
                    String failure = rs.getString("failure_reason");

                    Map<String, TaskSnapshot> tasksByRef = new HashMap<>();
                    String sqlTasks = "SELECT * FROM task_executions WHERE workflow_id = ?";
                    try (PreparedStatement psTasks = conn.prepareStatement(sqlTasks)) {
                        psTasks.setString(1, wfId);
                        try (ResultSet rsTasks = psTasks.executeQuery()) {
                            while (rsTasks.next()) {
                                TaskSnapshot snap = mapTaskSnapshot(rsTasks);
                                tasksByRef.put(snap.taskReferenceName(), snap);
                            }
                        }
                    }

                    list.add(new WorkflowSnapshot(
                        wfId, tId, wsId, name, version, st, input, output, failure, tasksByRef
                    ));
                }
            }
            return Collections.unmodifiableList(list);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list workflow executions from PostgreSQL", e);
        }
    }

    @Override
    public void saveTaskExecution(
        String taskId, String workflowId, String tenantId, String workspaceId,
        String referenceName, String taskType, String domain, TaskStatus status,
        int attempt, Map<String, Object> inputPayload, Map<String, Object> outputPayload,
        String errorDetails, long responseTimeoutMs, long nowEpochMs
    ) {
        String sql = """
            INSERT INTO task_executions 
            (task_id, workflow_id, tenant_id, workspace_id, reference_name, task_type, domain, status, attempt, input_payload, output_payload, error_details, response_timeout_ms, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?)
            ON CONFLICT (task_id) DO UPDATE SET
            status = EXCLUDED.status, output_payload = EXCLUDED.output_payload, error_details = EXCLUDED.error_details, updated_at_ms = EXCLUDED.updated_at_ms
            """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, taskId);
            ps.setString(2, workflowId);
            ps.setString(3, tenantId);
            ps.setString(4, workspaceId);
            ps.setString(5, referenceName);
            ps.setString(6, taskType);
            ps.setString(7, domain);
            ps.setString(8, status.name());
            ps.setInt(9, attempt);
            ps.setString(10, toJson(inputPayload));
            ps.setString(11, toJson(outputPayload));
            ps.setString(12, errorDetails);
            ps.setLong(13, responseTimeoutMs);
            ps.setLong(14, nowEpochMs);
            ps.setLong(15, nowEpochMs);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to save task execution in PostgreSQL", e);
        }
    }

    @Override
    public void updateTaskExecution(
        String taskId, TaskStatus status, Map<String, Object> outputPayload,
        String errorDetails, long nowEpochMs
    ) {
        String sql = "UPDATE task_executions SET status = ?, output_payload = ?::jsonb, error_details = ?, updated_at_ms = ? WHERE task_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            ps.setString(2, toJson(outputPayload));
            ps.setString(3, errorDetails);
            ps.setLong(4, nowEpochMs);
            ps.setString(5, taskId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update task execution in PostgreSQL", e);
        }
    }

    @Override
    public Optional<TaskSnapshot> getTaskExecution(String taskId) {
        String sql = "SELECT * FROM task_executions WHERE task_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, taskId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) return Optional.of(mapTaskSnapshot(rs));
                return Optional.empty();
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to get task execution from PostgreSQL", e);
        }
    }

    @Override
    public void enqueueTask(
        String taskId, String workflowId, String tenantId, String workspaceId,
        String taskType, String domain, int priority, long visibleAtEpochMs
    ) {
        String sql = """
            INSERT INTO task_queue (task_id, workflow_id, tenant_id, workspace_id, task_type, domain, priority, created_at_ms, visible_at_epoch_ms, lease_owner)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
            ON CONFLICT (task_id) DO UPDATE SET visible_at_epoch_ms = EXCLUDED.visible_at_epoch_ms, lease_owner = NULL
            """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, taskId);
            ps.setString(2, workflowId);
            ps.setString(3, tenantId);
            ps.setString(4, workspaceId);
            ps.setString(5, taskType);
            ps.setString(6, domain);
            ps.setInt(7, priority);
            ps.setLong(8, System.currentTimeMillis());
            ps.setLong(9, visibleAtEpochMs);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to enqueue task in PostgreSQL", e);
        }
    }

    @Override
    public List<TaskSnapshot> pollTasks(
        String tenantId, String taskType, String domain, int batchSize,
        String workerId, long responseTimeoutMs, long nowEpochMs
    ) {
        // FOR UPDATE SKIP LOCKED ensures race-free distributed polling with anti-starvation dynamic priority aging (+1 every 5s)
        String selectSql = """
            SELECT q.task_id FROM task_queue q
            LEFT JOIN task_executions t ON q.task_id = t.task_id
            WHERE (q.tenant_id = ? OR ? = 'system')
              AND (q.task_type = ? OR t.reference_name = ?)
              AND (q.domain = ? OR ? = '*')
              AND q.visible_at_epoch_ms <= ?
            ORDER BY (q.priority + CAST((? - q.created_at_ms) / 5000 AS INT)) DESC, q.visible_at_epoch_ms ASC 
            LIMIT ? FOR UPDATE OF q SKIP LOCKED
            """;
        String updateQueueSql = "UPDATE task_queue SET visible_at_epoch_ms = ?, lease_owner = ? WHERE task_id = ?";
        String updateTaskSql = "UPDATE task_executions SET status = 'IN_PROGRESS', worker_id = ?, updated_at_ms = ? WHERE task_id = ?";

        List<TaskSnapshot> results = new ArrayList<>();
        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            List<String> polledTaskIds = new ArrayList<>();

            try (PreparedStatement psSelect = conn.prepareStatement(selectSql)) {
                psSelect.setString(1, tenantId);
                psSelect.setString(2, tenantId);
                psSelect.setString(3, taskType);
                psSelect.setString(4, taskType);
                psSelect.setString(5, domain);
                psSelect.setString(6, domain);
                psSelect.setLong(7, nowEpochMs);
                psSelect.setLong(8, nowEpochMs);
                psSelect.setInt(9, batchSize);

                try (ResultSet rs = psSelect.executeQuery()) {
                    while (rs.next()) {
                        polledTaskIds.add(rs.getString("task_id"));
                    }
                }
            }

            long newVisibleAt = nowEpochMs + responseTimeoutMs;
            try (PreparedStatement psUpQ = conn.prepareStatement(updateQueueSql);
                 PreparedStatement psUpT = conn.prepareStatement(updateTaskSql)) {

                for (String taskId : polledTaskIds) {
                    psUpQ.setLong(1, newVisibleAt);
                    psUpQ.setString(2, workerId);
                    psUpQ.setString(3, taskId);
                    psUpQ.addBatch();

                    psUpT.setString(1, workerId);
                    psUpT.setLong(2, nowEpochMs);
                    psUpT.setString(3, taskId);
                    psUpT.addBatch();
                }
                psUpQ.executeBatch();
                psUpT.executeBatch();
            }

            conn.commit();

            for (String taskId : polledTaskIds) {
                getTaskExecution(taskId).ifPresent(results::add);
            }
            return Collections.unmodifiableList(results);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to poll tasks from PostgreSQL", e);
        }
    }

    @Override
    public boolean renewLease(String taskId, String workerId, long newVisibleAtEpochMs) {
        String sql = "UPDATE task_queue SET visible_at_epoch_ms = ? WHERE task_id = ? AND (lease_owner = ? OR lease_owner IS NULL)";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, newVisibleAtEpochMs);
            ps.setString(2, taskId);
            ps.setString(3, workerId);
            return ps.executeUpdate() > 0;
        } catch (SQLException e) {
            throw new RuntimeException("Failed to renew lease in PostgreSQL", e);
        }
    }

    @Override
    public void removeQueueTask(String taskId) {
        String sql = "DELETE FROM task_queue WHERE task_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, taskId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to remove queue task from PostgreSQL", e);
        }
    }

    @Override
    public List<TaskSnapshot> findExpiredLeaseTasks(long nowEpochMs) {
        String sql = """
            SELECT t.* FROM task_executions t
            JOIN task_queue q ON t.task_id = q.task_id
            WHERE q.lease_owner IS NOT NULL AND q.visible_at_epoch_ms <= ? AND t.status = 'IN_PROGRESS'
            """;
        List<TaskSnapshot> expired = new ArrayList<>();
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setLong(1, nowEpochMs);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    expired.add(mapTaskSnapshot(rs));
                }
            }
            return Collections.unmodifiableList(expired);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to find expired lease tasks in PostgreSQL", e);
        }
    }

    private TaskSnapshot mapTaskSnapshot(ResultSet rs) throws SQLException {
        TaskType type;
        try {
            type = TaskType.valueOf(rs.getString("task_type").toUpperCase());
        } catch (Exception e) {
            type = TaskType.SIMPLE;
        }
        return new TaskSnapshot(
            rs.getString("task_id"),
            rs.getString("reference_name"),
            type,
            rs.getString("domain"),
            TaskStatus.valueOf(rs.getString("status")),
            rs.getInt("attempt"),
            fromJson(rs.getString("input_payload")),
            fromJson(rs.getString("output_payload")),
            rs.getString("error_details"),
            0L,
            rs.getLong("response_timeout_ms"),
            rs.getString("worker_id")
        );
    }

    private String toJson(Object obj) {
        if (obj == null) return "{}";
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> fromJson(String json) {
        if (json == null || json.isBlank() || "null".equals(json)) return Collections.emptyMap();
        try {
            return objectMapper.readValue(json, Map.class);
        } catch (Exception e) {
            return Collections.emptyMap();
        }
    }

    private <T> T fromJson(String json, Class<T> clazz) {
        if (json == null || json.isBlank() || "null".equals(json)) return null;
        try {
            return objectMapper.readValue(json, clazz);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public void quarantineTaskToDlq(TaskDlqRecord record) {
        String insertSql = """
            INSERT INTO task_dlq (dlq_id, task_id, workflow_id, tenant_id, workspace_id, task_type, domain, error_message, error_stacktrace, payload_snapshot, retry_count, isolated_at_ms, replayed_at_ms, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?)
            ON CONFLICT (dlq_id) DO UPDATE SET status = EXCLUDED.status, replayed_at_ms = EXCLUDED.replayed_at_ms
            """;
        String deleteQueueSql = "DELETE FROM task_queue WHERE task_id = ?";

        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            try (PreparedStatement ps = conn.prepareStatement(insertSql)) {
                ps.setString(1, record.dlqId());
                ps.setString(2, record.taskId());
                ps.setString(3, record.workflowId());
                ps.setString(4, record.tenantId());
                ps.setString(5, record.workspaceId());
                ps.setString(6, record.taskType());
                ps.setString(7, record.domain());
                ps.setString(8, record.errorMessage());
                ps.setString(9, record.errorStacktrace());
                ps.setString(10, toJson(record.payloadSnapshot()));
                ps.setInt(11, record.retryCount());
                ps.setLong(12, record.isolatedAtMs());
                if (record.replayedAtMs() != null) {
                    ps.setLong(13, record.replayedAtMs());
                } else {
                    ps.setNull(13, Types.BIGINT);
                }
                ps.setString(14, record.status());
                ps.executeUpdate();
            }

            try (PreparedStatement psDel = conn.prepareStatement(deleteQueueSql)) {
                psDel.setString(1, record.taskId());
                psDel.executeUpdate();
            }
            conn.commit();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to quarantine task to DLQ in PostgreSQL", e);
        }
    }

    @Override
    public List<TaskDlqRecord> listDlqTasks(String tenantId, String status, int limit) {
        StringBuilder sql = new StringBuilder("SELECT * FROM task_dlq WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (tenantId != null && !tenantId.isBlank()) {
            sql.append(" AND tenant_id = ?");
            params.add(tenantId);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" AND status = ?");
            params.add(status);
        }
        sql.append(" ORDER BY isolated_at_ms DESC LIMIT ?");
        params.add(limit > 0 ? limit : 100);

        List<TaskDlqRecord> list = new ArrayList<>();
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql.toString())) {
            for (int i = 0; i < params.size(); i++) {
                Object p = params.get(i);
                if (p instanceof String s) ps.setString(i + 1, s);
                else if (p instanceof Integer n) ps.setInt(i + 1, n);
            }
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapTaskDlqRecord(rs));
                }
            }
            return Collections.unmodifiableList(list);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list DLQ tasks in PostgreSQL", e);
        }
    }

    @Override
    public Optional<TaskDlqRecord> getDlqTask(String dlqId) {
        String sql = "SELECT * FROM task_dlq WHERE dlq_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, dlqId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapTaskDlqRecord(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to get DLQ task in PostgreSQL", e);
        }
    }

    @Override
    public void updateDlqStatus(String dlqId, String status, Long replayedAtMs) {
        String sql = "UPDATE task_dlq SET status = ?, replayed_at_ms = ? WHERE dlq_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status);
            if (replayedAtMs != null) {
                ps.setLong(2, replayedAtMs);
            } else {
                ps.setNull(2, Types.BIGINT);
            }
            ps.setString(3, dlqId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update DLQ status in PostgreSQL", e);
        }
    }

    @Override
    public void deleteDlqTask(String dlqId) {
        String sql = "DELETE FROM task_dlq WHERE dlq_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, dlqId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to delete DLQ task in PostgreSQL", e);
        }
    }

    @Override
    public void saveDefinitionVersion(com.acc.workflow.core.model.WorkflowDefinitionRecord record) {
        String sql = """
            INSERT INTO workflow_definitions
            (definition_id, tenant_id, workflow_key, version, status, name, description, definition_json, published_at_ms, published_by, created_at_ms, updated_at_ms)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?, ?)
            ON CONFLICT (tenant_id, workflow_key, version)
            DO UPDATE SET status = EXCLUDED.status, name = EXCLUDED.name, description = EXCLUDED.description,
                          definition_json = EXCLUDED.definition_json, published_at_ms = EXCLUDED.published_at_ms,
                          published_by = EXCLUDED.published_by, updated_at_ms = EXCLUDED.updated_at_ms
            """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, record.definitionId());
            ps.setString(2, record.tenantId());
            ps.setString(3, record.workflowKey());
            ps.setInt(4, record.version());
            ps.setString(5, record.status().name());
            ps.setString(6, record.name());
            ps.setString(7, record.description());
            ps.setString(8, toJson(record.definition()));
            if (record.publishedAtMs() != null) ps.setLong(9, record.publishedAtMs()); else ps.setNull(9, Types.BIGINT);
            ps.setString(10, record.publishedBy());
            ps.setLong(11, record.createdAtMs());
            ps.setLong(12, record.updatedAtMs());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to save workflow definition version in PostgreSQL", e);
        }
    }

    @Override
    public Optional<com.acc.workflow.core.model.WorkflowDefinitionRecord> getDefinitionVersion(String tenantId, String workflowKey, int version) {
        String sql = "SELECT * FROM workflow_definitions WHERE tenant_id = ? AND workflow_key = ? AND version = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, tenantId != null ? tenantId : "system");
            ps.setString(2, workflowKey);
            ps.setInt(3, version);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapDefinitionRecord(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to get workflow definition version in PostgreSQL", e);
        }
    }

    @Override
    public List<com.acc.workflow.core.model.WorkflowDefinitionRecord> listDefinitionVersions(String tenantId, String workflowKey) {
        String sql = "SELECT * FROM workflow_definitions WHERE tenant_id = ? AND workflow_key = ? ORDER BY version ASC";
        List<com.acc.workflow.core.model.WorkflowDefinitionRecord> list = new ArrayList<>();
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, tenantId != null ? tenantId : "system");
            ps.setString(2, workflowKey);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapDefinitionRecord(rs));
                }
            }
            return Collections.unmodifiableList(list);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list workflow definition versions in PostgreSQL", e);
        }
    }

    @Override
    public void updateDefinitionStatus(String tenantId, String workflowKey, int version, com.acc.workflow.core.model.WorkflowVersionStatus status, Long publishedAtMs, String publishedBy) {
        String sql = "UPDATE workflow_definitions SET status = ?, published_at_ms = ?, published_by = ?, updated_at_ms = ? WHERE tenant_id = ? AND workflow_key = ? AND version = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            if (publishedAtMs != null) ps.setLong(2, publishedAtMs); else ps.setNull(2, Types.BIGINT);
            ps.setString(3, publishedBy);
            ps.setLong(4, System.currentTimeMillis());
            ps.setString(5, tenantId != null ? tenantId : "system");
            ps.setString(6, workflowKey);
            ps.setInt(7, version);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update definition status in PostgreSQL", e);
        }
    }

    @Override
    public void updateWorkflowDefinitionSnapshot(String workflowId, int newVersion, WorkflowDefinition newDefinitionSnapshot, long nowEpochMs) {
        String sql = "UPDATE workflow_executions SET version = ?, definition_snapshot = ?::jsonb, updated_at_ms = ? WHERE workflow_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setInt(1, newVersion);
            ps.setString(2, toJson(newDefinitionSnapshot));
            ps.setLong(3, nowEpochMs);
            ps.setString(4, workflowId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to hot-migrate workflow execution definition snapshot in PostgreSQL", e);
        }
    }

    @Override
    public void appendAuditRecord(com.acc.workflow.core.model.WorkflowAuditRecord record) {
        String sql = """
            INSERT INTO workflow_audit_log
            (event_id, workflow_id, tenant_id, actor_id, action, payload_snapshot, prev_hash, current_hash, created_at_ms)
            VALUES (?, ?, ?, ?, ?, ?::jsonb, ?, ?, ?)
            """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, record.eventId());
            ps.setString(2, record.workflowId());
            ps.setString(3, record.tenantId());
            ps.setString(4, record.actorId());
            ps.setString(5, record.action());
            ps.setString(6, toJson(record.payloadSnapshot()));
            ps.setString(7, record.prevHash());
            ps.setString(8, record.currentHash());
            ps.setLong(9, record.createdAtMs());
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to append audit record in PostgreSQL", e);
        }
    }

    @Override
    public List<com.acc.workflow.core.model.WorkflowAuditRecord> listAuditRecords(String workflowId) {
        String sql = "SELECT * FROM workflow_audit_log WHERE workflow_id = ? ORDER BY sequence_num ASC";
        List<com.acc.workflow.core.model.WorkflowAuditRecord> list = new ArrayList<>();
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, workflowId);
            try (ResultSet rs = ps.executeQuery()) {
                while (rs.next()) {
                    list.add(mapAuditRecord(rs));
                }
            }
            return Collections.unmodifiableList(list);
        } catch (SQLException e) {
            throw new RuntimeException("Failed to list audit records in PostgreSQL", e);
        }
    }

    @Override
    public Optional<com.acc.workflow.core.model.WorkflowAuditRecord> getLatestAuditRecord(String workflowId) {
        String sql = "SELECT * FROM workflow_audit_log WHERE workflow_id = ? ORDER BY sequence_num DESC LIMIT 1";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, workflowId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapAuditRecord(rs));
                }
            }
            return Optional.empty();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to get latest audit record in PostgreSQL", e);
        }
    }

    private com.acc.workflow.core.model.WorkflowDefinitionRecord mapDefinitionRecord(ResultSet rs) throws SQLException {
        long pubAt = rs.getLong("published_at_ms");
        Long publishedAtMs = rs.wasNull() ? null : pubAt;
        return new com.acc.workflow.core.model.WorkflowDefinitionRecord(
            rs.getString("definition_id"),
            rs.getString("tenant_id"),
            rs.getString("workflow_key"),
            rs.getInt("version"),
            com.acc.workflow.core.model.WorkflowVersionStatus.valueOf(rs.getString("status")),
            rs.getString("name"),
            rs.getString("description"),
            fromJson(rs.getString("definition_json"), WorkflowDefinition.class),
            publishedAtMs,
            rs.getString("published_by"),
            rs.getLong("created_at_ms"),
            rs.getLong("updated_at_ms")
        );
    }

    private com.acc.workflow.core.model.WorkflowAuditRecord mapAuditRecord(ResultSet rs) throws SQLException {
        return new com.acc.workflow.core.model.WorkflowAuditRecord(
            rs.getLong("sequence_num"),
            rs.getString("event_id"),
            rs.getString("workflow_id"),
            rs.getString("tenant_id"),
            rs.getString("actor_id"),
            rs.getString("action"),
            fromJson(rs.getString("payload_snapshot")),
            rs.getString("prev_hash"),
            rs.getString("current_hash"),
            rs.getLong("created_at_ms")
        );
    }

    private TaskDlqRecord mapTaskDlqRecord(ResultSet rs) throws SQLException {
        long replayedAt = rs.getLong("replayed_at_ms");
        Long replayedAtMs = rs.wasNull() ? null : replayedAt;
        return new TaskDlqRecord(
            rs.getString("dlq_id"),
            rs.getString("task_id"),
            rs.getString("workflow_id"),
            rs.getString("tenant_id"),
            rs.getString("workspace_id"),
            rs.getString("task_type"),
            rs.getString("domain"),
            rs.getString("error_message"),
            rs.getString("error_stacktrace"),
            fromJson(rs.getString("payload_snapshot")),
            rs.getInt("retry_count"),
            rs.getLong("isolated_at_ms"),
            replayedAtMs,
            rs.getString("status")
        );
    }
}
