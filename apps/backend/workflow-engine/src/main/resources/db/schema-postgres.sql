CREATE TABLE IF NOT EXISTS workflow_executions (
  workflow_id VARCHAR(64) PRIMARY KEY,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'system',
  workspace_id VARCHAR(64) NOT NULL DEFAULT 'default',
  workflow_name VARCHAR(128) NOT NULL,
  version INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  definition_snapshot JSONB NOT NULL,
  input_payload JSONB NOT NULL,
  output_payload JSONB,
  failure_reason TEXT,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_executions (
  task_id VARCHAR(128) PRIMARY KEY,
  workflow_id VARCHAR(64) NOT NULL REFERENCES workflow_executions(workflow_id),
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'system',
  workspace_id VARCHAR(64) NOT NULL DEFAULT 'default',
  reference_name VARCHAR(128) NOT NULL,
  task_type VARCHAR(32) NOT NULL,
  domain VARCHAR(64) NOT NULL DEFAULT 'default',
  status VARCHAR(32) NOT NULL,
  attempt INT NOT NULL DEFAULT 1,
  worker_id VARCHAR(128),
  input_payload JSONB NOT NULL,
  output_payload JSONB,
  error_details TEXT,
  task_logs JSONB,
  response_timeout_ms BIGINT NOT NULL DEFAULT 30000,
  created_at_ms BIGINT NOT NULL,
  updated_at_ms BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS task_queue (
  task_id VARCHAR(128) PRIMARY KEY,
  workflow_id VARCHAR(64) NOT NULL,
  tenant_id VARCHAR(64) NOT NULL DEFAULT 'system',
  workspace_id VARCHAR(64) NOT NULL DEFAULT 'default',
  task_type VARCHAR(32) NOT NULL,
  domain VARCHAR(64) NOT NULL DEFAULT 'default',
  priority INT NOT NULL DEFAULT 0,
  visible_at_epoch_ms BIGINT NOT NULL,
  lease_owner VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_task_queue_poll 
  ON task_queue (tenant_id, task_type, domain, visible_at_epoch_ms, priority DESC);
