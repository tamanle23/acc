# Walkthrough 49: Workflow Task Lease Watchdog, Dynamic Fork Barrier & PostgreSQL Functional Indexing

**App:** `@acc/backend`  
**Master Iteration Reference:** [`docs/iterations/master_implementation_plan_iteration_38.md`](file:///c:/Users/Admin/workspace/git/acc/docs/iterations/master_implementation_plan_iteration_38.md)  
**Date:** 2026-10-27  
**Version:** Iteration 38  

---

## 1. Overview
Implemented backend resilience and performance enhancements across the Workflow Engine and Dynamic Metadata Platform:
1. **Autonomous Task Lease Watchdog (`TaskLeaseWatchdog`)**:
   - Detects expired worker leases where `visible_at_epoch_ms <= now` and status is `IN_PROGRESS`.
   - Re-enqueues retryable tasks with attempt incremented.
   - If attempts reach `maxAttempts (3)`, isolates the task to `task_dlq` (`TaskDlqRecord`) with tag `TASK_LEASE_EXPIRED` and marks execution `TIMED_OUT`.
2. **Dynamic Fork Barrier Synchronization (`ForkJoinStrategy`)**:
   - Checks if prerequisite tasks in `joinOn` represent `DYNAMIC_FORK` branches.
   - Verifies all dynamically spawned children (`dynamicRefs`) have reached terminal status before completing the join barrier.
   - Fails-fast immediately if any dynamic child subtask fails or times out.
3. **Scheduled Watchdog Reaper (`SystemTaskWorkerPool`)**:
   - Added `@Scheduled(fixedDelay = 5000)` periodic watchdog cycle in `acc-ms-aio` calling `WorkflowEngineService.reapExpiredLeases()`.
4. **Dynamic PostgreSQL JSONB Expression Indexing (`DynamicIndexProvisioner` & `MetadataService`)**:
   - Added asynchronous `CREATE INDEX CONCURRENTLY IF NOT EXISTS` generation for single-entity `AttributeDefinition` entries when `options.indexed = true`.
   - Generates typed functional expressions: `((attributes->>'name')::numeric)` for numeric types, `((attributes->>'name')::timestamp)` for dates, and `(attributes->>'name')` for strings.
5. **SpEL Entity Mutation Predicates (`EntityWorkflowTriggerDispatcher`)**:
   - Replaced static string action matching with Spring Expression Language (SpEL) evaluation against `#old`, `#new`, and `#action` to eliminate trigger stampedes.

---

## 2. Verification
1. **Unit Tests**:
   - `TaskLeaseWatchdogTest`: Verified retry thresholding, DLQ quarantine, and `TIMED_OUT` status transitions.
   - `DynamicIndexProvisionerAttributeTest`: Verified typed functional SQL statement generation for STRING, NUMERIC, and DATE attributes.
   - `EntityWorkflowTriggerDispatcherSpELTest`: Verified SpEL condition evaluation against entity mutation deltas.
