# 167 - Eliminate Deterministic AI-Assisted Schema Generation

## Problem Statement
The user requested the complete elimination of "Deterministic AI-Assisted Schema Generation" from both the backend and frontend. The previous implementation was a hardcoded, heuristic-based mockup synthesizing attribute sets and FSM configurations without real LLM intelligence.

## Solution Plan
1. Delete backend classes:
   - `AiSchemaSynthesizerController.java`
   - `AiSchemaSynthesizerService.java`
   - `AiSchemaSynthesizerServiceTest.java`
2. Delete frontend modal:
   - `ai-schema-generator-modal.tsx`
3. Clean frontend references:
   - Remove "Generate with AI" button and modal trigger from `visual-schema-studio.tsx`.
   - Remove `useSynthesizeSchema` hook and related interfaces from `metadata-api.ts`.
   - Remove `/ai/synthesize-schema` route handler from `metadata-sandbox-adapter.ts`.
   - Remove modal test case from `iteration13-studio.test.tsx`.
4. Verify full-stack compilation and unit tests:
   - Backend `mvn test-compile -pl unipost-fw -q` exits 0.
   - Frontend `tsc --noEmit` and `vitest` pass with zero errors.

## Changes Made
- **Backend**:
  - Deleted `apps/backend/unipost-fw/src/main/java/com/unipost/service/metadata/AiSchemaSynthesizerService.java`
  - Deleted `apps/backend/unipost-fw/src/main/java/com/unipost/presentation/AiSchemaSynthesizerController.java`
  - Deleted `apps/backend/unipost-fw/src/test/java/com/unipost/service/metadata/AiSchemaSynthesizerServiceTest.java`
- **Frontend (`@unipost/console`)**:
  - Deleted `apps/console/src/features/metadata/components/studio/ai-schema-generator-modal.tsx`
  - Cleaned `apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx`
  - Cleaned `apps/console/src/features/metadata/api/metadata-api.ts`
  - Cleaned `apps/console/src/core/sandbox/handlers/metadata-sandbox-adapter.ts`
  - Cleaned `apps/console/src/features/metadata/components/studio/iteration13-studio.test.tsx`

## Verification
- Backend compile: `node mvnw.cjs test-compile -pl unipost-fw -q` -> Exit 0.
- Frontend typecheck: `pnpm --filter @unipost/console exec tsc --noEmit` -> Exit 0.
- Vitest suite: `pnpm --filter @unipost/console exec vitest run src/features/metadata/components/studio/iteration13-studio.test.tsx` -> 2/2 tests passed.
