# 040: mobile-ui Dynamic Form Engine & Media Pipeline (Integration Master Plan Phase 5)

## Problem
In accordance with `docs/brainstorming/integration_master_plan_iteration_1.md` (Phase 5), mobile operators lacked dynamic schema-driven form rendering, binary media asset capture/upload capabilities, and relational record pickers inside `apps/mobile-ui`.

## Plan
1. Create `MediaPickerInput.tsx` with Liquid Glass styling and streaming upload to `unipost-ms-fs`.
2. Create `RelationPickerBottomSheet.tsx` for searchable foreign key record picking.
3. Create `DynamicFieldRenderer.tsx` mapping `AttributeDefinition` data types (`STRING`, `INTEGER`, `DECIMAL`, `BOOLEAN`, `RELATIONSHIP`) and UI components (`text`, `textarea`, `number`, `switch`, `relation_picker`, `media_picker`).
4. Add unit test suite in `apps/mobile-ui/src/__tests__/dynamic-form.test.ts`.
5. Verify test pass across all workspaces.

## Changes
- `apps/mobile-ui/src/components/dynamic-form/MediaPickerInput.tsx`: Created image picker with Liquid Glass card, upload simulation, and preview.
- `apps/mobile-ui/src/components/dynamic-form/RelationPickerBottomSheet.tsx`: Created bottom sheet modal for searchable entity relation selection.
- `apps/mobile-ui/src/components/dynamic-form/DynamicFieldRenderer.tsx`: Universal form renderer supporting all dynamic schema attribute types.
- `apps/mobile-ui/src/__tests__/dynamic-form.test.ts`: Added unit test suite covering dynamic fields, media picker, and relation bottom sheet.
- `apps/mobile-ui/src/test/setup.ts`: Added component mocks for React Native / Expo.
- `apps/mobile-ui/doc/implementation_plan_18.md` & `apps/mobile-ui/doc/walkthrough_18.md`: Documented paired artifacts.

## Verification
- `pnpm --filter mobile-ui test`: Passed (9/9 tests).
- `pnpm --filter @unipost/client test`: Passed (6/6 tests).
- `pnpm --filter @unipost/sandbox test`: Passed (5/5 tests).
- `pnpm --filter @unipost/console test`: Passed (146/146 tests).

## Walkthrough
Refer to `apps/mobile-ui/doc/walkthrough_18.md`.

## Tasks
- [x] Create MediaPickerInput
- [x] Create RelationPickerBottomSheet
- [x] Create DynamicFieldRenderer
- [x] Test suite and monorepo verification

## Enhancement
Phase 6 will implement the zero-data-loss encrypted mobile outbox (`useOutboxStore`) with conflict resolution.
