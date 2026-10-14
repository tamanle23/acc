# 088: Conductor Node Strategies, Topological Frontiers & Parameter Resolver (Phase 27)

**Date**: 2026-10-14  
**Author**: Lead Systems Architect  
**Category**: feat(backend)  
**Scope**: `apps/backend/workflow-engine`

---

## 1. Problem Statement
Phase 27 of [`docs/integration_master_plan_iteration_3.md`](file:///c:/Users/Admin/workspace/git/unipost/docs/integration_master_plan_iteration_3.md) requires:
1. Flexible JSONPath-style expression resolution (`${workflow.input.*}`, `${taskRef.output.*}`).
2. Topological acyclicity enforcement via Kahn's algorithm with cycle path extraction.
3. Open/Closed `NodeStrategyRegistry` and strategies for `SIMPLE`, `SWITCH`, `FORK_JOIN`, `DYNAMIC_FORK`, `WAIT`, `DO_WHILE`.
4. Refactoring `PureDecider` to eliminate hardcoded branching while remaining 100% pure and zero-I/O.

---

## 2. Plan
1. Implement `ParameterResolver` with nested Map/List navigation and string interpolation.
2. Implement `AcyclicityGuard` and `WorkflowCycleDetectedException`.
3. Implement `NodeEvaluatorStrategy` interface and strategies for all node types in `com.unipost.workflow.core.decider.strategy`.
4. Register strategies in `NodeStrategyRegistry` and wire into `PureDecider`.
5. Write unit test suites for parameter resolution, cycle detection, and node strategies.

---

## 3. Changes Made
- [`ParameterResolver.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/expression/ParameterResolver.java): Pure parameter resolution engine.
- [`AcyclicityGuard.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/graph/AcyclicityGuard.java): Kahn's algorithm & DFS cycle path extractor.
- [`WorkflowCycleDetectedException.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/graph/WorkflowCycleDetectedException.java): Typed cycle exception.
- [`NodeEvaluatorStrategy.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/decider/strategy/NodeEvaluatorStrategy.java): Evaluation strategy interface.
- Strategy implementations: `SimpleTaskStrategy`, `SwitchNodeStrategy`, `ForkJoinStrategy`, `DynamicForkStrategy`, `WaitNodeStrategy`, `DoWhileStrategy`.
- [`NodeStrategyRegistry.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/decider/NodeStrategyRegistry.java): Strategy registry.
- [`PureDecider.java`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/workflow-engine/src/main/java/com/unipost/workflow/core/decider/PureDecider.java): Refactored to delegate to registry and parameter resolver.
- Test suites: `ParameterResolverTest.java`, `AcyclicityGuardTest.java`, `NodeStrategiesTest.java`.
- Documentation: [`apps/backend/doc/implementation_plan_31.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/doc/implementation_plan_31.md), [`apps/backend/doc/walkthrough_31.md`](file:///c:/Users/Admin/workspace/git/unipost/apps/backend/doc/walkthrough_31.md).

---

## 4. Verification
- `mvn test -pl workflow-engine`: **16/16 tests passing (1.84s)**.
