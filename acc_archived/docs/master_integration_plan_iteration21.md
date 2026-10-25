# Master Integration Plan - Iteration 21: RightSidebar & Inspector Iterative Improvement

Comprehensive iteration plan to diagnose, fix, and enhance [`RightSidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/RightSidebar.tsx) and its inspector sub-components ([`SequenceInspector.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/SequenceInspector.tsx), [`TrackInspector.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/TrackInspector.tsx), [`ProjectInspector.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/ProjectInspector.tsx)).

---

## 1. Goal Description

Following the architectural decomposition of `RightSidebar.tsx` into modular sub-inspectors, several functional and UX bugs remain across the inspector system:

1. **Timed Text Cues disappear into void**: When clicking `+ Add Cue`, a new cue is appended to `seq.cues`, but `SequenceInspector.tsx` renders zero UI to edit the cue's text or timings (`startOffsetMs`, `endOffsetMs`) or delete the cue.
2. **Lock State is pure dummy state**: `isLocked` in `SequenceInspector.tsx` toggles an amber badge on the lock button, but none of the inputs, time inputs, or modifiers are disabled or read-only (`disabled={isLocked}`).
3. **Relational Target Selection failure with empty/stale sequences**: When sequences exist on other tracks or when `otherSequenceIds` is empty, selecting relational start/duration can result in empty targets `""` or invalid timing constraints.
4. **Missing Relational Offset/Overlap Controls**: The UI supports selecting relation `after` or `syncWith`, but provides no inputs for `offsetFrames` or `overlapFrames`, leaving them silently locked at 0.
5. **Newly Attached Effects do not auto-expand**: Adding an effect appends the modifier, but if the section is not pre-populated in `openSections` (e.g. dynamic/custom modifiers), the accordion remains collapsed, confusing the user.
6. **No "+ Add Effect" CTA in the Empty State**: When a sequence has no modifiers, the empty state displays "Click + Add Effect above...", but has no direct clickable button inside the empty state card itself.
7. **Accessibility & WCAG 2.1 AA Contrast**: Low contrast on subtle text (`text-slate-400` on light background), missing `aria-label` attributes on icon-only buttons, and missing keyboard navigation support.

---

## 2. User Review Required

> [!IMPORTANT]
> - All changes strictly comply with **Rule 229**: `AccordionTrigger` children must never contain interactive elements; all trigger actions must remain in the `actions` prop.
> - `RightSidebar.tsx` remains strictly under the **350-line ceiling** enforced by `studio_inspector_plugin_parity.test.ts`.
> - All modifications preserve backward compatibility and immutable command dispatching through `IRStateManager`.

---

## 3. Detailed Proposed Changes

### Component 1: `SequenceInspector.tsx` & Timed Text Cue Editing

#### [MODIFY] [`SequenceInspector.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/SequenceInspector.tsx)

1. **Timed Text Cues Management (Option B - Modal / Dialog Manager)**:
   - Provide a clean "Manage Cues ({count})" button in `SequenceInspector.tsx` that opens a dedicated `CueTimelineDialog` modal.
   - Inside the dialog:
     - Table / timeline view displaying all subtitle cues.
     - Inputs for `text`, `startOffsetMs`, `endOffsetMs`, and preview duration.
     - Actions to add new cue, reorder, delete, and duplicate cue.
     - Fully accessible keyboard navigation and WCAG 2.1 AA focus rings.
     - Live synchronization via `IRStateManager.getInstance().updateSequenceProps(selectedSeqId, { cues })`.
2. **True Full Lock State (`isLocked`) Enforcement (Option A)**:
   - When `isLocked` is `true`, disable:
     - Start time inputs (absolute frame / relational dropdowns / offsets / overlaps).
     - Duration inputs (frames / seconds / relational switches / matchLengthOf).
     - Modifier parameter inputs, toggle switches, and removal buttons.
     - "Manage Cues" button and "+ Add Cue" actions.
     - Duplicate, Delete, and Add Effect buttons.
     - Propagate `disabled={isLocked}` down to `DynamicModifierInspector`.
3. **Relational Timing Complete Parameters & Auto-Clamp Fallback (Option A)**:
   - For `start` relational mode: Add number inputs for `offsetFrames` and `overlapFrames`.
   - For `duration` relational mode: Add target sequence dropdown and `paddingFrames` input when `matchLengthOf` is selected.
   - **Auto-Clamp Guard**: When `otherSequenceIds.length === 0` (<2 sequences exist in project), disable the "Relational" mode button with a helpful tooltip/badge: `"Requires ≥2 sequences"`, preventing invalid IR relational references.
4. **Empty State Direct Action**:
   - Add a primary "+ Add First Effect" button directly in the empty state card that triggers the modifier selection dropdown.

---

### Component 2: `RightSidebar.tsx` & Auto-Expansion on Add Effect

#### [MODIFY] [`RightSidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/RightSidebar.tsx)

1. **Auto-Expansion of New Modifiers (Option A)**:
   - When adding an effect in `handleAddEffect`, ensure the newly added effect section ID (`effect-${mod.type}`) is automatically appended to `openSections` state, keeping all existing open sections expanded while immediately opening the new effect.
2. **Dynamic Add Effect Menu Enhancements**:
   - Disable "Add Effect" button when the selected sequence `isLocked`.
   - Group modifiers by category (Motion & Transforms, 3D & Depth, Shaders & Particles, Audio DSP, Typography) with clear icons and checkmarks for already-attached effects.
3. **Accessibility Attributes**:
   - Ensure breadcrumb pills have explicit `aria-current="page"`, `aria-label`, and `focus-visible:ring-2`.

---

### Component 3: Dynamic Modifier Inspector & Parameter Controls

#### [MODIFY] [`DynamicModifierInspector.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/DynamicModifierInspector.tsx)
- Support a `disabled?: boolean` prop so that when a sequence is locked or a modifier is disabled, all nested parameter controls are cleanly rendered in read-only / disabled state according to the 5-State Component Matrix.

#### [MODIFY] [`ModifierControlStrategies.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/inspector/ModifierControlStrategies.tsx)
- Pass `disabled?: boolean` down to sliders, inputs, switches, color pickers, and preset buttons.

---

## 4. Verification Plan

### Automated Tests
1. Run existing test suites to prevent regression:
   ```bash
   bun test autogenerated-tests/studio_context_aware_inspector.test.ts
   bun test autogenerated-tests/studio_inspector_plugin_parity.test.ts
   ```
2. Create new unit test suite:
   `autogenerated-tests/studio_inspector_ux_improvements.test.ts`:
   - Test timed text cues editing and deletion.
   - Test `isLocked` guardrail disables controls.
   - Test relational timing offset and padding updates.
   - Test empty state rendering and behavior.
   - Test RightSidebar remains under 350 lines.

3. Verify production compilation:
   ```bash
   bun run --cwd apps/studio build
   ```

### Manual Verification
- In Studio, click on a text sequence (`track-subtitles` / `seq-sub-1`):
  - Verify timed text cues can be created, edited, and deleted.
- Toggle Lock: verify all editing controls become disabled.
- Add an effect: verify the effect is added and its accordion panel is immediately open.
- Set relational start and modify offset/overlap frames.
