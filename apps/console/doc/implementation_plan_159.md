# Composite Entities: Bento Studio Only

## Goal Description
In the Metadata screen, the **Schema** tab for a composite entity (`entityType.isComposite`) currently shows the standard field-list UI. That UI has an **Add Field** button, a field search box, a field counter and a **Standard List ↔ Visual Studio** toggle. The Visual Studio mode also shows the *Schema Canvas* and *FSM Workflow Studio* tabs.

Composite entities are projections over other entity types. They have no manual fields, so the Schema tab for them should show **only the Composite Bento Studio**.

Decisions confirmed with the user:
- Composite entities show only Composite Bento Studio. The Schema Canvas and FSM Workflow Studio tabs are hidden.
- The field search, field counter, Add Field button and list/studio toggle are hidden for composite entities. The Draft-07 JSON preview stays available.

## Proposed Changes

### Schema tab (`schema-builder.tsx`)
#### [MODIFY] [schema-builder.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/schema-builder/schema-builder.tsx)
- Derive `const isComposite = Boolean(entityType?.isComposite);`.
- Add an early branch at the top of the render. For composite entities it renders a slim header (title plus a "Composite" badge plus the Draft-07 JSON button) and then `<VisualSchemaStudio entityTypeId={entityTypeId} />`.
- For composite entities, force-ignore `isStudioMode`.
- For composite entities, do not render the search input, the `x/100 Fields` badge, the Standard List/Visual Studio toggle, or the **Add Field** button.
- The AttributeDialog and AttributeDeleteDialog stay unmounted for composite entities, so there is no manual field entry path.
- Non-composite entities keep their current behavior (zero regression).

### Visual studio (`visual-schema-studio.tsx`)
#### [MODIFY] [visual-schema-studio.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/visual-schema-studio.tsx)
- If `entityType?.isComposite`, render only `<CompositeBentoStudio />` under a header that has no tab list.
- `activeStudioTab` is derived (`isComposite ? 'composite' : state`) instead of being set in an effect. This removes a one-frame flash of the Canvas tab.
- The `AttributePalette`, inspector and `FsmWorkflowDesigner` branches are not rendered for composite entities. The `useCreateAttributeDefinition` and `useUpdateAttributeDefinition` mutations stay wired for non-composite entities.

### Guard against deep links and API use
#### [MODIFY] [metadata-feature.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/metadata-feature.tsx)
- The existing effect that auto-switches composite entities from `schema` to `data` stays unchanged. The Schema tab is reachable for composite entities only by an explicit click, which now lands on the Bento Studio.

### Tests
#### [MODIFY] [visual-schema-studio.test.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/features/metadata/components/studio/visual-schema-studio.test.tsx)
- Add test: composite entity renders Bento Studio and does not render the `Schema Canvas & Live Preview` or `FSM Workflow Studio` tabs.
#### [NEW] `schema-builder.composite.test.tsx` (in `schema-builder/__tests__/`)
- Composite entity: no `Add Field` button, no `Filter fields...` input, no `Visual Studio` or `Standard List` toggle, Bento Studio is present, `Draft-07 JSON` is present.
- Non-composite entity: `Add Field` and the toggle are still present (regression guard).

### Docs
- Update `apps/console/ROUTE.md` and `DESIGN.md` to describe that the composite Schema tab is Bento-only.
- Add `docs/history/XXX_composite_bento_only.md` and a README entry per the repo rules.
- Add a local `apps/console/doc/NN_composite_bento_only_plan.md` copy of this plan.

## Verification Plan

### Automated Tests
```
pnpm --filter @acc/console test -- visual-schema-studio schema-builder composite-bento-studio
pnpm --filter @acc/console exec tsc --noEmit
```

### Manual Verification
1. Open Metadata with the sandbox enabled, select a composite entity, and open the Schema tab.
2. Confirm only the Composite Bento Studio shows, with no Add Field, no field search, no list/studio toggle, and no Canvas or Workflow tabs.
3. Confirm Draft-07 JSON still opens.
4. Select a non-composite entity and confirm that the Schema tab is unchanged.

## Open Questions
> [!NOTE]
> The i18n rule says to avoid hardcoded text, but this component currently uses hardcoded English. I plan to use `t('key','fallback')` only for the new strings I add, and not to refactor the existing text.
