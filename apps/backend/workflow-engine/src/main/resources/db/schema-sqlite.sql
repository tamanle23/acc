CREATE TABLE IF NOT EXISTS workflow_executions (
  workflow_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'system',
  workspace_id TEXT NOT NULL DEFAULT 'default',
  workflow_name TEXT NOT NULL,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  definition_snapshot TEXT NOT NULL,
  input_payload TEXT NOT NULL,
  output_payload TEXT,
  failure_reason TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS task_executions (
  task_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'system',
  workspace_id TEXT NOT NULL DEFAULT 'default',
  reference_name TEXT NOT NULL,
  task_type TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1,
  worker_id TEXT,
  input_payload TEXT NOT NULL,
  output_payload TEXT,
  error_details TEXT,
  task_logs TEXT,
  response_timeout_ms INTEGER NOT NULL DEFAULT 30000,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflow_executions(workflow_id)
);

CREATE TABLE IF NOT EXISTS task_queue (
  task_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'system',
  workspace_id TEXT NOT NULL DEFAULT 'default',
  task_type TEXT NOT NULL,
  domain TEXT NOT NULL DEFAULT 'default',
  priority INTEGER NOT NULL DEFAULT 0,
  visible_at_epoch_ms INTEGER NOT NULL,
  lease_owner TEXT
);

CREATE INDEX IF NOT EXISTS idx_queue_poll 
  ON task_queue (tenant_id, task_type, domain, visible_at_epoch_ms, priority DESC);
