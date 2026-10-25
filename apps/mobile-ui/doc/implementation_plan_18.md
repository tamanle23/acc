# Implementation Plan 18: Phase 5 - mobile-ui Dynamic Form Engine & Media Pipeline

## 1. Overview
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 5), implement the Dynamic Form Engine and Media Pipeline in `apps/mobile-ui`:
1. `MediaPickerInput.tsx`:
   - Liquid Glass card/input allowing mobile operators to pick or snap photos.
   - Client-side size & aspect ratio validation.
   - Mock/live streaming binary upload simulation returning immutable content URIs (e.g. `acc-ms-fs:///objects/{id}`).
2. `RelationPickerBottomSheet.tsx`:
   - Bottom sheet / modal dialog for foreign key relationship selection.
   - Searches and lists available entity records conforming to target entity type.
   - Supports selecting related record IDs with Liquid Glass UI styling.
3. `DynamicFieldRenderer.tsx`:
   - Maps metadata attributes (`STRING`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `DATE`, `DATETIME`, `JSON`, `RELATIONSHIP`) and UI component types (`text`, `textarea`, `number`, `switch`, `select`, `multiselect`, `datepicker`, `json_editor`, `relation_picker`, `media_picker`).
   - Renders appropriate inputs with full Liquid Glass styling and validation feedback.
4. Unit tests in `apps/mobile-ui/src/__tests__/dynamic-form.test.ts`:
   - Tests rendering and value mutations across all dynamic field types.
   - Tests MediaPickerInput image attachment.
   - Tests RelationPicker selection.

## 2. Target Files
- `apps/mobile-ui/src/components/dynamic-form/MediaPickerInput.tsx` (new)
- `apps/mobile-ui/src/components/dynamic-form/RelationPickerBottomSheet.tsx` (new)
- `apps/mobile-ui/src/components/dynamic-form/DynamicFieldRenderer.tsx` (new)
- `apps/mobile-ui/src/__tests__/dynamic-form.test.ts` (new)

## 3. Verification Plan
- `pnpm --filter mobile-ui test` verifies 100% pass on dynamic form tests.
- Monorepo full verification: `@acc/client`, `@acc/sandbox`, `@acc/console`, and `mobile-ui`.
