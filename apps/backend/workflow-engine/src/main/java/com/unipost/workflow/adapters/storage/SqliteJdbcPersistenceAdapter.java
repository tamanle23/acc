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

import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * SQLite JDBC Persistence Adapter (Local-First).
 * Configures PRAGMA journal_mode = WAL and busy_timeout = 5000.
 */
public final class SqliteJdbcPersistenceAdapter implements PersistencePort {

    private final String jdbcUrl;
    private final ObjectMapper objectMapper = new ObjectMapper().registerModule(new JavaTimeModule());

    public SqliteJdbcPersistenceAdapter(String jdbcUrl) {
        this.jdbcUrl = jdbcUrl;
        initializeSchema();
    }

    private Connection getConnection() throws SQLException {
        Connection conn = DriverManager.getConnection(jdbcUrl);
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("PRAGMA journal_mode = WAL;");
            stmt.execute("PRAGMA busy_timeout = 5000;");
        }
        return conn;
    }

    private void initializeSchema() {
        try (Connection conn = getConnection(); Statement stmt = conn.createStatement()) {
            InputStream is = getClass().getResourceAsStream("/db/schema-sqlite.sql");
            if (is != null) {
                String ddl = new String(is.readAllBytes(), StandardCharsets.UTF_8);
                for (String sql : ddl.split(";")) {
                    if (!sql.trim().isEmpty()) {
                        stmt.execute(sql.trim());
                    }
                }
            }
        } catch (Exception e) {
            throw new RuntimeException("Failed to initialize SQLite schema", e);
        }
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(workflow_id) DO UPDATE SET 
            status = excluded.status, output_payload = excluded.output_payload, failure_reason = excluded.failure_reason, updated_at_ms = excluded.updated_at_ms
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
            throw new RuntimeException("Failed to save workflow execution", e);
        }
    }

    @Override
    public void updateWorkflowStatus(
        String workflowId, WorkflowStatus status, Map<String, Object> outputPayload,
        String failureReason, long nowEpochMs
    ) {
        String sql = "UPDATE workflow_executions SET status = ?, output_payload = ?, failure_reason = ?, updated_at_ms = ? WHERE workflow_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            ps.setString(2, toJson(outputPayload));
            ps.setString(3, failureReason);
            ps.setLong(4, nowEpochMs);
            ps.setString(5, workflowId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update workflow status", e);
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
                if (!rsWf.next()) {
                    return Optional.empty();
                }

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
            throw new RuntimeException("Failed to get workflow snapshot", e);
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
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(task_id) DO UPDATE SET 
            status = excluded.status, output_payload = excluded.output_payload, error_details = excluded.error_details, updated_at_ms = excluded.updated_at_ms
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
            throw new RuntimeException("Failed to save task execution", e);
        }
    }

    @Override
    public void updateTaskExecution(
        String taskId, TaskStatus status, Map<String, Object> outputPayload,
        String errorDetails, long nowEpochMs
    ) {
        String sql = "UPDATE task_executions SET status = ?, output_payload = ?, error_details = ?, updated_at_ms = ? WHERE task_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, status.name());
            ps.setString(2, toJson(outputPayload));
            ps.setString(3, errorDetails);
            ps.setLong(4, nowEpochMs);
            ps.setString(5, taskId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to update task execution", e);
        }
    }

    @Override
    public Optional<TaskSnapshot> getTaskExecution(String taskId) {
        String sql = "SELECT * FROM task_executions WHERE task_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, taskId);
            try (ResultSet rs = ps.executeQuery()) {
                if (rs.next()) {
                    return Optional.of(mapTaskSnapshot(rs));
                }
                return Optional.empty();
            }
        } catch (SQLException e) {
            throw new RuntimeException("Failed to get task execution", e);
        }
    }

    @Override
    public void enqueueTask(
        String taskId, String workflowId, String tenantId, String workspaceId,
        String taskType, String domain, int priority, long visibleAtEpochMs
    ) {
        String sql = """
            INSERT INTO task_queue (task_id, workflow_id, tenant_id, workspace_id, task_type, domain, priority, visible_at_epoch_ms, lease_owner)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL)
            ON CONFLICT(task_id) DO UPDATE SET visible_at_epoch_ms = excluded.visible_at_epoch_ms, lease_owner = NULL
            """;
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, taskId);
            ps.setString(2, workflowId);
            ps.setString(3, tenantId);
            ps.setString(4, workspaceId);
            ps.setString(5, taskType);
            ps.setString(6, domain);
            ps.setInt(7, priority);
            ps.setLong(8, visibleAtEpochMs);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to enqueue task", e);
        }
    }

    @Override
    public List<TaskSnapshot> pollTasks(
        String tenantId, String taskType, String domain, int batchSize,
        String workerId, long responseTimeoutMs, long nowEpochMs
    ) {
        String selectSql = """
            SELECT task_id FROM task_queue 
            WHERE tenant_id = ? AND task_type = ? AND domain = ? AND visible_at_epoch_ms <= ?
            ORDER BY priority DESC, visible_at_epoch_ms ASC LIMIT ?
            """;
        String updateQueueSql = "UPDATE task_queue SET visible_at_epoch_ms = ?, lease_owner = ? WHERE task_id = ?";
        String updateTaskSql = "UPDATE task_executions SET status = 'IN_PROGRESS', worker_id = ?, updated_at_ms = ? WHERE task_id = ?";

        List<TaskSnapshot> results = new ArrayList<>();
        try (Connection conn = getConnection()) {
            conn.setAutoCommit(false);
            List<String> polledTaskIds = new ArrayList<>();

            try (PreparedStatement psSelect = conn.prepareStatement(selectSql)) {
                psSelect.setString(1, tenantId);
                psSelect.setString(2, taskType);
                psSelect.setString(3, domain);
                psSelect.setLong(4, nowEpochMs);
                psSelect.setInt(5, batchSize);

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
            throw new RuntimeException("Failed to poll tasks from SQLite", e);
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
            throw new RuntimeException("Failed to renew lease", e);
        }
    }

    @Override
    public void removeQueueTask(String taskId) {
        String sql = "DELETE FROM task_queue WHERE task_id = ?";
        try (Connection conn = getConnection(); PreparedStatement ps = conn.prepareStatement(sql)) {
            ps.setString(1, taskId);
            ps.executeUpdate();
        } catch (SQLException e) {
            throw new RuntimeException("Failed to delete queue task", e);
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
            throw new RuntimeException("Failed to find expired lease tasks", e);
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
}
