# History Log 455: Mandatory Workflow Input/Output Schemas and Unaware Task Context Passing

## Problem
In earlier iterations of the workflow orchestration engine, workflow definitions lacked formal, mandatory schema contracts on both their entry boundaries (`workflow.input`) and terminal exit boundaries (`workflow.output`).
1. **Unbounded Input Payloads**: Incoming HTTP trigger requests could deliver arbitrary unstructured JSON without schema verification, leading to downstream runtime failures, null pointer exceptions, and unhandled data corruption during execution.
2. **Missing Terminal Exit Enforcement**: Workflows terminated without validating that output payloads satisfied the declared contract or fulfilled required response fields.
3. **Coupled Task Logic vs Workflow Graph Adapter**: Reusable tasks risked becoming tightly coupled with workflow-level expression parsing instead of functioning as pure, unaware hexagonal units of work with contract-driven parameter adapters.
4. **Studio Authoring Gaps**: Visual DAG Studio lacked first-class visual schema editing for Start and End nodes, 1-click schema inference from sample payloads or terminal parameter mappings, and an I/O Contracts inspector.

## Plan
1. **Backend Core Hardening (`workflow-engine`)**:
   - Add non-null Draft 7 `Map<String, Object> inputSchema` and `Map<String, Object> outputSchema` to [`WorkflowDefinition`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowDefinition.java) and [`TaskDefinition`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskDefinition.java).
   - Implement zero-overhead Draft 7 JSON Schema validator [`WorkflowSchemaValidator`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/schema/WorkflowSchemaValidator.java) enforcing strict typing, required fields, and `additionalProperties: false` (bypassing internal engine meta-flags like `__`).
   - Wire fail-fast validation in [`EndWorkflowStrategy`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/EndWorkflowStrategy.java), failing with `OUTPUT_SCHEMA_VIOLATION` if terminal output fails schema validation.
2. **Backend API Gateway Validation (`acc-ms-aio`)**:
   - In [`WorkflowExecutionController`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowExecutionController.java), strictly validate `request.input()` against `def.inputSchema()`. Return HTTP 400 Bad Request with field-level violation details on failure before initializing execution.
3. **Frontend Studio Contracts & Unaware Context Adapters (`@acc/console`)**:
   - Extend [`WorkflowIR`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts) with `inputSchema` and `outputSchema` and provide default Draft 7 schema.
   - Implement `inferDraft7Schema()` utility to automatically derive Draft 7 schemas from JSON sample objects.
   - Enhance [`DagPropertyInspector`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx):
     - **Start Node**: Render Draft 7 Input Schema Contract, "Infer Schema from Sample" button, and default input payload editor.
     - **End Node**: Render Draft 7 Exit Output Schema Contract, satisfaction banner checking required properties, and "Infer Schema from Mappings" button.
     - **Standard Tasks**: Display worker schema requirements and "Auto-Bind Missing" inputs.
   - Create [`WorkflowContractsModal`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/modals/workflow-contracts-modal.tsx) and add "I/O Contracts" toolbar action in [`DagHeaderCommandBar`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/toolbar/dag-header-command-bar.tsx).
   - Update semantic linter [`dag-semantic-linter.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts) with `MISSING_WORKFLOW_INPUT_SCHEMA`, `MISSING_WORKFLOW_OUTPUT_SCHEMA`, and `UNSATISFIED_WORKFLOW_OUTPUT`.
4. **Verification & Archival**:
   - Run backend unit and integration test suites.
   - Run frontend TypeScript type checks and vitest suites.

## Changes
- **Backend Core (`workflow-engine`):**
  - [`WorkflowDefinition.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/WorkflowDefinition.java): Added `inputSchema`, `outputSchema`, and `defaultDraft7Schema()`.
  - [`TaskDefinition.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/model/TaskDefinition.java): Added `outputSchema` field.
  - [`WorkflowSchemaValidator.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/schema/WorkflowSchemaValidator.java): Implemented zero-I/O JSON schema validator supporting Draft 7 types, required properties, and strict property validation.
  - [`WorkflowSchemaValidatorTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/core/schema/WorkflowSchemaValidatorTest.java): Added 6 unit tests covering all schema validation paths.
  - [`EndWorkflowStrategy.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/main/java/com/acc/workflow/core/decider/strategy/EndWorkflowStrategy.java): Wired schema verification before terminating executions.
  - [`EndWorkflowStrategyValidationTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/workflow-engine/src/test/java/com/acc/workflow/core/decider/strategy/EndWorkflowStrategyValidationTest.java): Verified pass and rejection paths.
- **Backend API (`acc-ms-aio`):**
  - [`WorkflowExecutionController.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/main/java/com/acc/aio/controller/workflow/WorkflowExecutionController.java): Enforced HTTP 400 Bad Request rejection with validation details when trigger inputs violate `inputSchema`.
  - [`WorkflowEngineRestApiTest.java`](file:///c:/Users/Admin/workspace/git/acc/apps/backend/acc-ms-aio/src/test/java/com/acc/aio/controller/workflow/WorkflowEngineRestApiTest.java): Updated pipeline test definitions with schemas and added `testWorkflowTriggerSchemaValidationRejection`.
- **Frontend Studio (`apps/console`):**
  - [`workflow-ir-converter.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/utils/workflow-ir-converter.ts): Added `DEFAULT_DRAFT7_SCHEMA`, `inferDraft7Schema()`, and updated IR serialization.
  - [`dag-sample-data.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/utils/dag-sample-data.ts): Initialized blank DAG nodes with default Draft 7 schemas.
  - [`dag-semantic-linter.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/utils/validation/dag-semantic-linter.ts): Added rules for missing workflow input/output schemas and unsatisfied output mappings.
  - [`dag-property-inspector.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/inspectors/dag-property-inspector.tsx):
    - Added Draft 7 schema visual editor and "Infer Schema from Sample" button on Start node.
    - Added Draft 7 schema visual editor, satisfaction alert, and "Infer Schema from Mappings" button on End node.
    - Added worker schema requirement checklist and auto-bind button for standard task nodes.
  - [`workflow-contracts-modal.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/modals/workflow-contracts-modal.tsx): Created side-by-side contract specification modal.
  - [`dag-header-command-bar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/toolbar/dag-header-command-bar.tsx): Added "I/O Contracts" action button.
  - [`visual-dag-studio.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/visual-dag-studio.tsx) & [`dag-modals-container.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/workflows/components/studio/modals/dag-modals-container.tsx): Wired `WorkflowContractsModal` with deep navigation to Start/End node inspectors.

## Verification
- **Backend Tests**:
  - `workflow-engine`: All unit tests passed (including `WorkflowSchemaValidatorTest` and `EndWorkflowStrategyValidationTest`).
  - `acc-ms-aio`: `WorkflowEngineRestApiTest` passed completely (including HTTP 400 rejection on invalid trigger payload).
- **Frontend Tests**:
  - `pnpm --filter @acc/console exec tsc --noEmit`: 0 errors.
  - `pnpm --filter @acc/console exec vitest run "src/features/workflows"`: 38/38 test suites passed, 189/189 tests passed.

## Walkthrough
1. **Trigger Gate Validation**: Submitting a workflow execution trigger payload missing required attributes or supplying extra undeclared keys now returns HTTP 400 with `WORKFLOW_INPUT_VALIDATION_FAILED` before execution creation.
2. **Terminal Exit Gate Validation**: When an execution reaches its End node, resolved parameters are validated against `outputSchema`. Any violation triggers an immediate `OUTPUT_SCHEMA_VIOLATION` terminal failure.
3. **Visual DAG Studio 2.0**:
   - In the canvas toolbar, click **"I/O Contracts"** to view side-by-side Draft 7 specifications and real-time mapping satisfaction.
   - Inspecting the Start Node presents the Draft 7 Input Schema editor with **"⚡ Infer Schema from Sample"**.
   - Inspecting the End Node presents the Draft 7 Output Schema editor with **"⚡ Infer Schema from Mappings"** and flags unmapped required fields.
   - Standard tasks display worker schema requirements with **"Auto-Bind Missing"** parameter actions.

## Tasks
- [x] Implement backend Draft 7 JSON schema validation and exit gates (`WorkflowSchemaValidator`, `EndWorkflowStrategy`).
- [x] Wire API trigger gate validation in `WorkflowExecutionController`.
- [x] Extend `WorkflowIR` and DAG semantic linter with mandatory workflow I/O schema rules.
- [x] Implement schema inference utilities and visual inspectors for Start/End nodes.
- [x] Create and wire `WorkflowContractsModal` and Studio toolbar action.
- [x] Verify backend tests, console vitest suites, and typecheck.

## Enhancement
- Future iterations can support advanced Draft 7 constraints (e.g. `pattern`, `format`, `minimum`/`maximum`, `oneOf`) and visual JSON schema builders with drag-and-drop property builders.
