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

1. **Timed Text Cues Interactive List**:
   - Render each cue in `selectedSeq.cues` with:
     - Text input for cue text, wired to `IRStateManager.getInstance().updateTextCue(...)` or updating `cues` array.
     - Start offset (`ms`) and End offset (`ms`) inputs.
     - Delete cue button.
     - Visual cue count and duration indicators.
2. **True Lock State (`isLocked`) Enforcement**:
   - When `isLocked` is `true`, disable:
     - Start time inputs (absolute frame / relational dropdowns).
     - Duration inputs (frames / seconds / relational switches).
     - Modifier parameter inputs and removal buttons.
     - Cue inputs and Add Cue button.
     - Duplicate and Delete buttons.
3. **Relational Timing Complete Parameters**:
   - For `start` relational mode: Add number inputs for `offsetFrames` and `overlapFrames`.
   - For `duration` relational mode: Add target sequence dropdown and `paddingFrames` input when `matchLengthOf` is selected.
   - Graceful fallback when `otherSequenceIds.length === 0`: Show an alert banner explaining that relational timing requires at least 2 sequences in the project.
4. **Empty State Direct Action**:
   - Add a primary "+ Add First Effect" button directly in the empty state card that opens the modifier picker dropdown or triggers the first available modifier.

---

### Component 2: `RightSidebar.tsx` & Auto-Expansion on Add Effect

#### [MODIFY] [`RightSidebar.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/studio/src/components/RightSidebar.tsx)

1. **Auto-Expansion of New Modifiers**:
   - When adding an effect, notify or dispatch the section ID to automatically expand the accordion item for that effect.
2. **Dynamic Add Effect Menu Enhancements**:
   - Group modifiers by category (Motion & Transforms, 3D & Depth, Shaders & Particles, Audio DSP, Typography).
   - Display shortcut badge or descriptive subtitle.
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
