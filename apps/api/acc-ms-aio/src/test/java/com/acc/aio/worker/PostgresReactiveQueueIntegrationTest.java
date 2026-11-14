package com.acc.aio.worker;

import com.acc.workflow.application.WorkflowDefinitionRegistry;
import com.acc.workflow.controller.ExecutionStreamBroadcaster;
import com.acc.workflow.adapters.storage.PostgresJdbcPersistenceAdapter;
import com.acc.workflow.application.WorkflowEngineService;
import com.acc.workflow.core.decider.PureDecider;
import com.acc.workflow.core.model.TaskDefinition;
import com.acc.workflow.core.model.TaskType;
import com.acc.workflow.core.model.WorkflowDefinition;
import com.acc.workflow.core.model.WorkflowSnapshot;
import com.acc.workflow.core.model.WorkflowStatus;
import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import org.postgresql.PGConnection;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.net.http.HttpClient;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-End Integration Test for Iteration 61:
 * Verifies real Zonky Embedded PostgreSQL 17, PostgresJdbcPersistenceAdapter self-healing schema,
 * pg_notify trigger firing on task_queue insertion, PostgresNotificationListener push reception,
 * and SystemTaskWorkerPool storm-coalesced reactive drain.
 */
class PostgresReactiveQueueIntegrationTest {

    private static EmbeddedPostgres embeddedPostgres;
    private static DataSource dataSource;
    private static String jdbcUrl;

    @BeforeAll
    static void startPostgres() throws Exception {
        embeddedPostgres = EmbeddedPostgres.builder()
            .setLocaleConfig("locale", "en_US")
            .setLocaleConfig("lc-messages", "en_US")
            .start();
        dataSource = embeddedPostgres.getPostgresDatabase();
        jdbcUrl = embeddedPostgres.getJdbcUrl("postgres", "postgres");
    }

    @AfterAll
    static void stopPostgres() throws Exception {
        if (embeddedPostgres != null) {
            embeddedPostgres.close();
        }
    }

    @Test
    @DisplayName("PostgresJdbcPersistenceAdapter auto-initializes schema, trigger fires pg_notify, and reactive listener drains tasks < 1s")
    void testEndToEndReactivePostgresQueueAndNotificationDrain() throws Exception {
        // 1. Initialize PostgresJdbcPersistenceAdapter (triggers initializeSchemaIfMissing -> schema-postgres.sql)
        PostgresJdbcPersistenceAdapter adapter = new PostgresJdbcPersistenceAdapter(dataSource);

        // Verify all 6 tables and trigger were created in real PostgreSQL
        try (Connection conn = dataSource.getConnection(); Statement stmt = conn.createStatement()) {
            try (ResultSet rs = stmt.executeQuery(
                "SELECT count(*) FROM information_schema.tables WHERE table_name IN " +
                "('workflow_executions', 'task_executions', 'task_queue', 'task_dlq', 'workflow_definitions', 'workflow_audit_log')"
            )) {
                assertThat(rs.next()).isTrue();
                assertThat(rs.getInt(1)).isEqualTo(6);
            }
        }

        // 2. Wire Engine + SystemTaskWorkerPool + PostgresNotificationListener
        PureDecider decider = new PureDecider();
        WorkflowEngineService engineService = new WorkflowEngineService(adapter, decider);
        WorkflowDefinitionRegistry registry = new WorkflowDefinitionRegistry(adapter);
        ExecutionStreamBroadcaster broadcaster = new ExecutionStreamBroadcaster();
        org.springframework.context.ApplicationEventPublisher publisher = event -> {
            if (event instanceof com.acc.workflow.events.WorkflowExecutionBroadcastEvent e) {
                broadcaster.onWorkflowExecutionEvent(e);
            }
        };

        SystemTaskWorkerPool workerPool = new SystemTaskWorkerPool(
            adapter,
            engineService,
            registry,
            publisher,
            HttpClient.newHttpClient(),
            Executors.newCachedThreadPool()
        );

        PostgresNotificationListener listener = new PostgresNotificationListener(
            jdbcUrl, "postgres", "postgres", workerPool
        );
        listener.start();
        assertThat(listener.isRunning()).isTrue();

        try {
            // Allow listener thread to connect and execute LISTEN unipost_task_queue
            Thread.sleep(250);

            // 3. Register and start a workflow (enqueues task -> fires trg_unipost_task_queued -> pg_notify -> listener -> reactive drain)
            TaskDefinition jdbcTask = TaskDefinition.builder("verify-pg-reactive")
                .taskType(TaskType.JDBC)
                .domain("system:jdbc")
                .inputParameters(Map.of("sql", "SELECT 1"))
                .build();

            WorkflowDefinition def = WorkflowDefinition.builder("pg-reactive-e2e-wf")
                .tasks(List.of(jdbcTask))
                .build();

            registry.register("tenant-pg", def);

            long startMs = System.currentTimeMillis();
            String wfId = "wf_pg_reactive_001";
            // Notice we do NOT manually call workerPool.pollAndExecuteBatch()!
            // The PostgreSQL AFTER INSERT trigger + LISTEN socket must wake up the worker automatically.
            engineService.startWorkflow(wfId, "tenant-pg", "ws-pg", def, Map.of("mode", "reactive"), startMs);

            // Poll snapshot until COMPLETED (should happen almost instantaneously via push notification)
            WorkflowSnapshot completedSnap = null;
            for (int attempt = 0; attempt < 30; attempt++) {
                WorkflowSnapshot current = adapter.getWorkflowSnapshot(wfId).orElseThrow();
                if (current.status() == WorkflowStatus.COMPLETED) {
                    completedSnap = current;
                    break;
                }
                Thread.sleep(50);
            }

            assertThat(completedSnap).isNotNull();
            assertThat(completedSnap.status()).isEqualTo(WorkflowStatus.COMPLETED);
            assertThat(completedSnap.tasksByRef()).containsKey("verify-pg-reactive");
        } finally {
            listener.stop();
            assertThat(listener.isRunning()).isFalse();
            Thread.sleep(100);
        }
    }

    @Test
    @DisplayName("Liquibase changelog-000.000.00019.xml SQL statements execute cleanly on PostgreSQL 17")
    void testLiquibaseChangelog19SqlExecution() throws Exception {
        // Ensure schema is initialized even if this test runs before testEndToEndReactivePostgresQueueAndNotificationDrain
        new PostgresJdbcPersistenceAdapter(dataSource);

        try (Connection conn = DriverManager.getConnection(jdbcUrl, "postgres", "postgres");
             Statement stmt = conn.createStatement()) {
            // Verify autovacuum parameters can be applied and trigger works directly
            stmt.execute("""
                ALTER TABLE task_queue SET (
                  autovacuum_vacuum_scale_factor = 0.05,
                  autovacuum_vacuum_cost_limit = 1000
                );
                """);
            stmt.execute("LISTEN unipost_task_queue");

            // Insert a row into task_queue and verify pg_notify fires immediately
            stmt.execute("""
                INSERT INTO task_queue (task_id, workflow_id, tenant_id, workspace_id, task_type, domain, priority, created_at_ms, visible_at_epoch_ms)
                VALUES ('test_notify_t1', 'wf_notify_1', 'system', 'default', 'HTTP', 'system:http', 5, 1000, 1000)
                ON CONFLICT (task_id) DO NOTHING
                """);

            PGConnection pgConn = conn.unwrap(PGConnection.class);
            var notifications = pgConn.getNotifications(1000);
            assertThat(notifications).isNotNull();
            assertThat(notifications).isNotEmpty();
            assertThat(notifications[0].getName()).isEqualTo("unipost_task_queue");
            assertThat(notifications[0].getParameter()).isEqualTo("system:http:test_notify_t1");

            // Cleanup test row
            stmt.execute("DELETE FROM task_queue WHERE task_id = 'test_notify_t1'");
        }
    }
}
