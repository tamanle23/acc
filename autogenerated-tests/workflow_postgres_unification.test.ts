import { describe, test, expect } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';

const ROOT_DIR = path.resolve(__dirname, '..');

describe('Iteration 61: Enhanced Unified PostgreSQL Architecture for Workflow Engine', () => {
  test('TC-WF-01: Changelog 19 declares all 6 workflow tables, autovacuum tuning, and pg_notify trigger', () => {
    const changelogPath = path.join(
      ROOT_DIR,
      'apps/backend/acc-db/src/main/resources/db/acc/changelog-000.000.00019.xml'
    );
    expect(fs.existsSync(changelogPath)).toBe(true);

    const content = fs.readFileSync(changelogPath, 'utf-8');
    expect(content).toContain('workflow-engine-schema-001');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS workflow_executions');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS task_executions');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS task_queue');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS task_dlq');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS workflow_definitions');
    expect(content).toContain('CREATE TABLE IF NOT EXISTS workflow_audit_log');
    expect(content).toContain('idx_task_queue_poll');
    expect(content).toContain('autovacuum_vacuum_scale_factor = 0.05');
    expect(content).toContain('notify_unipost_task_queued');
    expect(content).toContain('trg_unipost_task_queued');
    expect(content).toContain('unipost_task_queue');
  });

  test('TC-WF-02: Master changelogs in acc-db and acc-sandbox include changelog-000.000.00019.xml', () => {
    const accDbMaster = path.join(
      ROOT_DIR,
      'apps/backend/acc-db/src/main/resources/db/acc/changelog-master.xml'
    );
    const sandboxMaster = path.join(
      ROOT_DIR,
      'apps/backend/acc-sandbox/src/main/resources/db/sandbox/changelog-master.xml'
    );

    expect(fs.readFileSync(accDbMaster, 'utf-8')).toContain('db/acc/changelog-000.000.00019.xml');
    expect(fs.readFileSync(sandboxMaster, 'utf-8')).toContain('db/acc/changelog-000.000.00019.xml');
  });

  test('TC-WF-03: PostgresJdbcPersistenceAdapter includes defensive initializeSchemaIfMissing()', () => {
    const adapterPath = path.join(
      ROOT_DIR,
      'apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/PostgresJdbcPersistenceAdapter.java'
    );
    const content = fs.readFileSync(adapterPath, 'utf-8');
    expect(content).toContain('initializeSchemaIfMissing()');
    expect(content).toContain("table_name = 'task_queue'");
    expect(content).toContain('/db/schema-postgres.sql');
  });

  test('TC-WF-04: WorkflowEngineConfiguration configures isolated HikariPool-WorkflowEngine and listener bean', () => {
    const configPath = path.join(
      ROOT_DIR,
      'apps/backend/acc-ms-aio/src/main/java/com/acc/aio/config/WorkflowEngineConfiguration.java'
    );
    const content = fs.readFileSync(configPath, 'utf-8');
    expect(content).toContain('HikariPool-WorkflowEngine');
    expect(content).toContain('setMinimumIdle(2)');
    expect(content).toContain('setMaximumPoolSize(4)');
    expect(content).toContain('PostgresNotificationListener');
    expect(content).toContain('workflowDataSource');
  });

  test('TC-WF-05: PostgresNotificationListener and SystemTaskWorkerPool storm coalescing', () => {
    const listenerPath = path.join(
      ROOT_DIR,
      'apps/backend/acc-ms-aio/src/main/java/com/acc/aio/worker/PostgresNotificationListener.java'
    );
    expect(fs.existsSync(listenerPath)).toBe(true);
    const listenerContent = fs.readFileSync(listenerPath, 'utf-8');
    expect(listenerContent).toContain('unipost_task_queue');
    expect(listenerContent).toContain('PGConnection');
    expect(listenerContent).toContain('getNotifications(5000)');
    expect(listenerContent).toContain('triggerReactiveDrain()');

    const workerPoolPath = path.join(
      ROOT_DIR,
      'apps/backend/acc-ms-aio/src/main/java/com/acc/aio/worker/SystemTaskWorkerPool.java'
    );
    const workerContent = fs.readFileSync(workerPoolPath, 'utf-8');
    expect(workerContent).toContain('drainScheduled');
    expect(workerContent).toContain('triggerReactiveDrain()');
    expect(workerContent).toContain('drainScheduled.compareAndSet(false, true)');
    expect(workerContent).toContain('@Scheduled(fixedDelay = 5000)');
  });

  test('TC-WF-06: SQLite adapter and dependency marked deprecated/optional', () => {
    const sqliteAdapterPath = path.join(
      ROOT_DIR,
      'apps/backend/workflow-engine/src/main/java/com/acc/workflow/adapters/storage/SqliteJdbcPersistenceAdapter.java'
    );
    const sqliteContent = fs.readFileSync(sqliteAdapterPath, 'utf-8');
    expect(sqliteContent).toContain('@Deprecated');

    const pomPath = path.join(ROOT_DIR, 'apps/backend/workflow-engine/pom.xml');
    const pomContent = fs.readFileSync(pomPath, 'utf-8');
    expect(pomContent).toContain('<optional>true</optional>');
  });
});
