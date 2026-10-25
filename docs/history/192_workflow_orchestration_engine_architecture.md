# 192. Workflow Orchestration Engine Architectural Blueprint & Master Specification

**Date:** 2026-10-24  
**Author:** Antigravity (Lead Systems Architect & Full-Stack Engineer)  
**Status:** Completed  

---

## 1. Problem Statement
The acc platform's distributed workflow capabilities have grown across multiple domains: a pure state machine (`PureDecider`), 23 task strategy implementations, an asynchronous worker lease protocol, Java 21 Loom SSE broadcasting, a dual-mode Visual DAG Studio 2.0 with follow-live auto-pan and time-travel replay, and an offline Unified Sandbox simulation engine.

To ensure long-term architectural stability, seamless developer onboarding, and zero regression during future iterations, a comprehensive, repository-wide Single Source of Truth (SSOT) was needed to anchor the system's designs, invariants, protocols, and contracts.

---

## 2. Plan
1. Author [`docs/workflow_orchestration_engine_architecture.md`](../docs/workflow_orchestration_engine_architecture.md) detailing:
   - The Three Sacred Invariants (Zero-I/O Decider, Strict Topological DAGs, Zero-Stub Sandbox Parity).
   - High-Level Topology & Flowchart across `@acc/console`, API Gateway, `workflow-engine`, Persistence, and Worker Fleet.
   - Strategy Matrix for all 23 task node types.
   - Parameter Resolution & Scoping Hierarchy (`${workflow.input.*}`, `${node.output.*}`, `${system.*}`).
   - Distributed Worker Lease Protocol & Auto-Heartbeat Sequence.
   - Visual DAG Studio 2.0 architecture and dual operational modes.
   - Dead-Letter Queue (DLQ) recovery and Fleet Hot Migration strategies.
2. Synchronize Living Documentation:
   - Update `apps/console/ROUTE.md` with Blueprints 3.11 (`/workflows`) and 3.12 (`/workflow-executions`).
   - Update `apps/console/DESIGN.md` with Section 3.8 Visual DAG Studio & Telemetry tokens.
3. Mirror app-specific artifacts to `apps/console/doc/implementation_plan_150.md` and `apps/console/doc/walkthrough_150.md`.
4. Run full-stack compilation and test verification.

---

## 3. Changes Made
- **Master SSOT Document**:
  - Created `docs/workflow_orchestration_engine_architecture.md`.
- **Route & Design Specifications**:
  - Updated `apps/console/ROUTE.md` (Blueprints for `/workflows` & `/workflow-executions`).
  - Updated `apps/console/DESIGN.md` (Tokens for studio nodes, KPI bars, and floating scrubbers).
- **Artifacts**:
  - `apps/console/doc/implementation_plan_150.md`
  - `apps/console/doc/walkthrough_150.md`
- **History Archival**:
  - Created `docs/history/192_workflow_orchestration_engine_architecture.md`.
  - Updated `docs/history/README.md`.

---

## 4. Verification
- `pnpm --filter @acc/console exec tsc --noEmit` (Exited 0, clean frontend type check).
- `pnpm --filter @acc/console test -- run src/features/workflows src/features/workflow-executions` (25 test files, 105 tests passing).
- `./mvnw.cmd test-compile -q` in `apps/backend` (Exited 0, clean Java 21 / Spring compilation).

---

## 5. Walkthrough Reference
See [`apps/console/doc/walkthrough_150.md`](../apps/console/doc/walkthrough_150.md) for full summary.
