# History Log 061: Visual Dynamic Schema & State Machine (FSM) Workflow Studio (Phase 22)

**Date**: 2026-10-14  
**Scope**: `apps/console`  
**Phase**: 22 (Iteration 2 Master Plan)

---

## 1. Problem Statement
Tenant administrators and domain operators required a zero-code authoring environment to design dynamic entities, custom attributes, and Finite State Machine (FSM) lifecycles:
1. **Visual Schema Canvas**:
   - Draggable palette of attributes (Primitive, Complex, Extended Custom Widgets like SignaturePad, BarcodeScanner, GeoLocation).
   - Attribute property inspector to configure JSON Schema constraints (`pattern`, `min`, `max`, `isRequired`, default values).
   - Instant live interactive preview rendering `<DynamicFieldRenderer />` with simulated submission payloads.
2. **Interactive FSM State Machine Workflow Designer**:
   - Visual state graph displaying sequential and curved DAG transitions (`DRAFT`, `SUBMITTED`, `APPROVED`, `PUBLISHED`, `ARCHIVED`).
   - Transition inspector for Spring Expression Language (SpEL) guard expression authoring (e.g. `attributes['total_amount'] < 50000`).
   - Outbox side-effect action stage configuration (e.g. `NOTIFICATION_DISPATCH`, `AUDIT_LOG`) aligning with the transactional outbox architecture.

---

## 2. Plan
1. **Define Types & Models (`apps/console/src/features/metadata/components/studio/studio-types.ts`)**:
   - Palette items, FSM state nodes, FSM transition edges, and workflow definitions.
2. **Build Studio Components**:
   - `attribute-palette.tsx`: Categorized palette items with click & HTML5 drag-and-drop triggers.
   - `attribute-property-inspector.tsx`: Constraints editor for JSON Schema validation.
   - `dynamic-form-live-preview.tsx`: Real-time reactive preview using standard `@acc/ui` widgets.
   - `fsm-workflow-designer.tsx`: SVG state machine canvas with transition selection, SpEL guard editor, and outbox action inspector.
   - `visual-schema-studio.tsx`: Master coordinator with tab switcher between Schema Canvas & FSM Workflow Studio.
3. **Integrate into SchemaBuilder (`schema-builder.tsx`)**:
   - Add "Visual Studio" / "Standard List" view toggle button.
4. **Unit Tests & Verification**:
   - Test palette category rendering and click callbacks.
   - Test property inspector constraint validation and updates.
   - Test FSM state graph rendering, transition switching, and SpEL guard display.

---

## 3. Changes Made

### `apps/console/src/features/metadata/components/studio/`
- Created `studio-types.ts`: Defined `PaletteFieldItem`, `FsmStateNode`, `FsmTransitionEdge`, `FsmWorkflowDefinition`.
- Created `attribute-palette.tsx`: Rendered 11 attribute types across Primitive, Complex, and Extended widgets.
- Created `attribute-property-inspector.tsx`: Reactive property inspector with constraints for mandatory fields, regex patterns, min/max numbers, and default values.
- Created `dynamic-form-live-preview.tsx`: Live form preview using `DynamicFieldRenderer`, with reset and simulated submission payload inspector.
- Created `fsm-workflow-designer.tsx`: SVG state machine canvas connecting `DRAFT`, `SUBMITTED`, `APPROVED`, `PUBLISHED`, `ARCHIVED` with curved Bezier edges, SpEL guard builder, and outbox actions.
- Created `visual-schema-studio.tsx`: 3-column responsive layout coordinating Palette (3 cols), Inspector (4 cols), and Live Preview (5 cols), alongside the FSM Workflow tab.
- Created `index.ts`: Barrel exports for the studio module.
- Created `visual-schema-studio.test.tsx`: 7 unit tests covering all Studio components.

### `apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx`
- Integrated `VisualSchemaStudio` with mode toggle button (`Visual Studio` / `Standard List`).

---

## 4. Verification
- Vitest suite `visual-schema-studio.test.tsx`: 7 tests passed cleanly.
- Staged and committed only Phase 22 files without disturbing other sessions.

---

## 5. Next Steps
- **Phase 23**: Tenant Custom Theming, White-Labeling & Dynamic Domain Blueprint Seeding.
- **Phase 24**: Turborepo & GitHub Actions Strict CI/CD Gatekeeper.
- **Phase 25**: Penetration Fuzzing, Chaos Stress & Security Hardening.
