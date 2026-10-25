---
name: database-architect-ops
description: Architect, optimize, and manage production databases, schema designs, and database operations. Use when designing data models, relational and NoSQL schemas, indexing strategies, zero-downtime migrations (Liquibase, Flyway, expand-contract), transaction isolation, replication, connection pooling, slow query profiling (EXPLAIN ANALYZE), or backup/recovery operations.
---

# Database Architect and Operations

Specialized instructions for designing, scaling, optimizing, and operating resilient enterprise databases across relational (PostgreSQL, MySQL), NoSQL, and hybrid distributed persistence layers.

## When to Use

- Designing normalized, dimensional, or hybrid relational/document (e.g., PostgreSQL JSONB) schemas.
- Developing zero-downtime database migration strategies with tools like Liquibase, Flyway, or native DDL.
- Diagnosing query bottlenecks, profiling query execution plans (`EXPLAIN (ANALYZE, BUFFERS)`), and designing indexing schemes.
- Configuring high availability, streaming replication, read replicas, and connection pooling (PgBouncer, HikariCP).
- Establishing transactional integrity, isolation levels, concurrency controls, and distributed data patterns (Transactional Outbox, Saga).
- Formulating database operational procedures: backups, point-in-time recovery (PITR), autovacuum tuning, and maintenance routines.

## Core Workflows and Guidelines

### 1. Schema Design and Data Modeling

- **Model according to access patterns**: Normalize to 3NF for core transactional domains to eliminate update anomalies. Denormalize selectively into read-optimized views, materialized tables, or document stores only when read latency requirements justify sync complexity.
- **Hybrid Relational-Document Storage**: Use JSONB columns for flexible, semi-structured, or user-defined dynamic attributes. Retain primary identifiers, foreign keys, status fields, and frequently filtered dimensions as typed relational columns.
- **Primary Keys**: Prefer `BIGINT GENERATED ALWAYS AS IDENTITY` for high-throughput relational tables to optimize B-Tree index locality, or UUIDv7 when distributed generation without coordination is required. Avoid random UUIDv4 as primary keys on high-insert tables due to B-Tree page fragmentation.
- **Partitioning Strategy**: Partition large transactional tables (>50M rows or time-series data) by range or hash. Ensure queries route cleanly by including partition keys in filter criteria.

### 2. Indexing Strategy and Query Optimization

- **Targeted B-Tree Indexes**: Index foreign keys, high-cardinality search columns, and join predicates. Order composite index columns starting with equality filters, followed by range filters and sort columns: `(status, created_at)`.
- **Covering Indexes (`INCLUDE`)**: Include non-key payload columns in index leaf nodes to enable index-only scans without widening the search key tree.
- **Specialized Indexes**:
  
  - Partial Indexes: Index only active rows (e.g., `WHERE status = 'PENDING'`) to minimize index footprint and write overhead.
  - GIN/GiST Indexes: Apply GIN to JSONB fields using `jsonb_path_ops` for containment queries (`@>`), full-text search, or array containment.
  
- **Query Profiling**:
  
  - Always inspect query execution with `EXPLAIN (ANALYZE, BUFFERS, VERBOSE)`.
  - Check buffer hit ratios. Eliminate disk-spill sorts by allocating appropriate `work_mem` or rewriting queries.
  - Eliminate sequential scans on large tables by fixing predicate data type mismatches or adding missing composite indexes.

### 3. Zero-Downtime Schema Migrations

- **The Expand-Contract Pattern**: Never rename or drop columns in a single deployment.
  
  1. Expand: Add the new column/table nullable. Deploy code that dual-writes to both old and new structures.
  2. Backfill: Migrate legacy rows in small, throttled batches to prevent table lock escalation and replication lag.
  3. Switch Reads: Direct read traffic to the new column/table.
  4. Contract: Stop writing to the old structure and drop it in a subsequent release.

- **Safe DDL Operations**:
  
  - Set explicit, strict lock timeouts (`SET lock_timeout = '2s';`) before running schema alterations.
  - Create indexes concurrently (`CREATE INDEX CONCURRENTLY` in PostgreSQL) to avoid acquiring exclusive table locks.
  - Add columns with default values using PostgreSQL 11+ metadata-only defaults, avoiding full-table rewrites.
  - Add foreign key constraints in two steps: `NOT VALID` first, followed by `VALIDATE CONSTRAINT` in a separate transaction.

### 4. Concurrency, Locks, and Transactions

- **Transaction Scope**: Keep database transactions as short as possible. Never execute network I/O, external API calls, or heavy non-database computation inside a database transaction block.
- **Isolation Levels**: Default to `READ COMMITTED`. Escalate to `REPEATABLE READ` or `SERIALIZABLE` only when preventing non-repeatable reads or phantom phenomena is mandatory, handling serialization failure retries (`40001`) in application code.
- **Deadlock Mitigation**: Ensure transactional workflows update rows across multiple tables in a deterministic, consistent order across all application endpoints.
- **Transactional Outbox**: Decouple event publishing from database operations by persisting domain events into an outbox table within the same ACID transaction, allowing an asynchronous relay worker to publish messages to brokers.

### 5. High Availability, Pooling, and Operations

- **Connection Management**: Always place a connection pooler (e.g., PgBouncer in transaction pooling mode) between distributed application instances and the primary database. Match application connection pools (e.g., HikariCP) to database CPU cores: `connections = (2 * CPU_cores) + disk_count`.
- **Replication**: Configure streaming physical replication with at least one synchronous replica for zero data loss (RPO = 0) and asynchronous read replicas for offloading reporting queries.
- **Autovacuum Tuning (PostgreSQL)**: Tune `autovacuum_vacuum_scale_factor` (e.g., 0.05) and `autovacuum_vacuum_cost_limit` to prevent bloat and transaction ID wraparound on high-churn tables.
- **Disaster Recovery**: Implement automated daily base backups paired with continuous WAL archiving to provide Point-In-Time Recovery (PITR). Regularly verify and drill backup restoration procedures.

## Gotchas

- **Unindexed Foreign Keys**: Cascading deletes or updates without an index on the child table's foreign key will trigger full table scans and lock the child table.
- **Connection Spikes**: Connecting application instances directly without a connection pooler exhausts PostgreSQL `max_connections`, leading to memory exhaustion and connection rejection.
- **Long-Running Transactions**: A single uncommitted long-running transaction holds back the database transaction ID horizon (xmin), preventing autovacuum from cleaning dead tuples across the entire cluster.
- **Index Overhead**: Every index accelerates specific reads at the expense of write throughput and vacuum maintenance. Audit and drop unused or redundant indexes periodically.
