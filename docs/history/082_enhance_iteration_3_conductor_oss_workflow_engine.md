# 082: Enhance Integration Master Plan Iteration 3 with Conductor OSS & Local-First Workflow Architecture

**Date**: 2026-10-14  
**Author**: Lead Systems Architect  
**Category**: docs(architecture)  
**Scope**: `docs/integration_master_plan_iteration_3.md`

---

## 1. Problem Statement
The initial draft of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/integration_master_plan_iteration_3.md) centered on an imperative DAG execution service with Hazelcast distributed locks and generic pub/sub dispatch. While functional for basic graphs, enterprise-grade distributed workflow orchestration demands:
1. **Deterministic, Reproducible Decider Loops**: Avoiding I/O, framework, and lock entanglements inside the core state machine.
2. **Workflow Definition Immutability**: Preventing running workflows from experiencing breaking state mutations when definitions evolve.
3. **Conductor-Grade Node Semantics**: Supporting advanced patterns such as `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, and `DO_WHILE`.
4. **Resilient, Brokerless Queueing**: Providing a single-column lease queue model capable of running local-first (SQLite WAL) as well as cloud-native (PostgreSQL RLS with `SKIP LOCKED`) without external message brokers.
5. **High-Ergonomics Worker SDK**: Enabling virtual-thread polling, automatic background lease heartbeating, typed input binding, and explicit outcome control (`Completed`, `InProgress(callbackAfterSeconds)`, `Failed(retryable)`).

---

## 2. Plan & Synthesis
Analyzed [`docs/brainstorming/Local-First-Workflow-Orchestration-Engine.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/brainstorming/Local-First-Workflow-Orchestration-Engine.md) to integrate battle-tested patterns inspired by Netflix Conductor OSS and Hexagonal Architecture into `docs/integration_master_plan_iteration_3.md`.

Synthesized 5 restructured phases:
- **Phase 26**: Canonical Workflow IR, Memento Snapshots & Zero-I/O `PureDecider`.
- **Phase 27**: Conductor Node Strategies (`NodeStrategyRegistry`), Kahn's Topological Frontiers & `ParameterResolver`.
- **Phase 28**: Hexagonal Engine, Single-Column Lease Queue (`visible_at_epoch_ms`), and Dual Storage Adapters (PostgreSQL / SQLite WAL).
- **Phase 29**: Virtual-Thread Worker SDK (`WorkerHost`), Composable Middleware Chain & Distributed Saga Compensation.
- **Phase 30**: Visual React Flow Studio (`@unipost/console`), Unified Sandbox Simulator (`@unipost/sandbox`), and Chaos Replay Suite.

---

## 3. Changes Made
- Updated [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/integration_master_plan_iteration_3.md):
  - Added Hexagonal Architecture architecture diagram showing `PureDecider`, `UnitOfWork`, single-column lease queue, and virtual-thread worker host.
  - Formulated 7 Non-Negotiable Architectural Invariants including Zero-I/O Functional Core, Memento Immutability, Single-Column Lease Queue, Transactional Outbox, Zero-Loss Visual Round-Trip, Zero Synthetic Mocks, and Multi-Tenant Context.
  - Deepened specifications across all 5 phases (26 to 30) detailing domain models, sealed engine commands, node strategies, relational hybrid schemas, worker contracts, and chaos testing.

---

## 4. Verification
- Verified file syntax and markdown structure.
- Validated cross-references to monorepo rules (Zero-Synthetic-Mocks, Unified Sandbox Platform, Hexagonal boundaries).
- Updated history index and staged changes.
