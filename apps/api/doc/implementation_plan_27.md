# Implementation Plan 27: Declarative State Machines & Operational Workflows (Phase 12)

## Problem Statement
Dynamic enterprise records (such as orders, compliance verifications, support tickets) need deterministic lifecycle workflows with strictly governed state transitions, role authorization gates, mandatory attribute checks, and dynamic guard expressions without hardcoded procedural logic.

## Architectural Design
Following [`docs/brainstorming/track_2_declarative_state_machines_design.md`](file:///c:/Users/Admin/workspace/git/acc/docs/brainstorming/track_2_declarative_state_machines_design.md):
1. **Liquibase Schema Migration**:
   - `changelog-000.000.00010.xml`: Added `lifecycle_config` JSONB column to `UNIPOST_ENTITY_TYPES` and registered in `changelog-master.xml`.
2. **Domain Model & DTOs**:
   - `LifecycleConfig.java` & `TransitionConfig.java` representing the declarative state machine schema.
   - `EntityType.java` mapping `lifecycle_config` via Hibernate JSONB (`SqlTypes.JSON`).
   - `EntityTypeResponse.java` exposing `lifecycleConfig` with backwards-compatible constructor.
   - `EntityStateChangedEvent.java` representing state transition domain events.
3. **5-Gate Sequential Validation Engine**:
   - Implemented `EntityLifecycleService.java`:
     - **Gate 1**: Tenant Context Isolation Gate.
     - **Gate 2**: State Graph Transition Validity Gate.
     - **Gate 3**: Role-Based Authority Gate (Spring Security).
     - **Gate 4**: Required Attribute Presence Gate.
     - **Gate 5**: Dynamic Guard Expression Gate using `GuardEvaluatorStrategy` and `SpelGuardEvaluator`.
4. **Integration with Write Pipeline & REST API**:
   - `MetadataService.java`:
     - Initialized default state on `createEntityRecord`.
     - Implemented `transitionRecordState` executing state validation, optimistic locking, and outbox event enqueueing.
   - `MetadataController.java`:
     - Added endpoint `POST /api/v1/metadata/entity-types/{id}/records/{recordId}/transition?action={action}`.
   - `WorkflowAuditEventListener.java`:
     - Listens to `EntityStateChangedEvent` asynchronously (`@TransactionalEventListener(phase = AFTER_COMMIT) + @Async`).

## Verification Plan
1. Unit test `EntityLifecycleServiceTest` covering all 5 validation gates.
2. Unit test `MetadataServiceTest` verifying state transitions.
3. Unit test `MetadataControllerTest` verifying transition REST endpoint.
4. Verify edge consumer build (`tekgo-ui`).
