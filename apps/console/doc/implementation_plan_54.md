# Implementation Plan 54 - Metadata Relationship UX & Integrity Enhancements

Scope: `@acc/console` (Schema Builder, Dynamic Field Renderer, Data Explorer) & Metadata System Behavior.

---

## 1. Executive Summary & Brainstormed Problem Analysis

Following the rollout of Phase 6 (Entity Relationship Types and Edge Inspector), several critical UI interaction frictions and un-logical system behaviors were identified in the relationship modeling and `relation_picker` workflow:

### A. Semantic Misplacement in Schema Builder
- **Issue**: The **Target Entity Model** selector was placed in the secondary "Validation & Options" tab.
- **Architectural Reality**: In metadata modeling, referencing another entity model is a core semantic type definition (equivalent to a foreign key descriptor), not a minor constraint like `min`/`max` or `placeholder`.
- **Target Resolution**: Move **Target Entity Model** directly into **General & Types** right below `UI Component` and `Storage Data Type`. Enforce that saving an attribute with `relation_picker` requires selecting a valid target model.

### B. Poor Record Selection Experience (Simple Select vs. Searchable ComboBox)
- **Issue**: The record picker used a simple `<Select>` dropdown.
- **Flaws**:
  1. *Scalability*: Fails when the target entity has hundreds or thousands of records.
  2. *Searchability*: Users could not search across record attributes (e.g. searching "Canary" or "Google" or "#102").
  3. *Inability to Unset*: No clean way to clear an optional foreign key reference back to `null`/empty.
- **Target Resolution**: Implement a robust **ComboBox** using Popover + Command Palette (`cmdk`), enabling instant fuzzy search across record `#ID` and readable attributes (e.g., `legal_name`, `policy_id`, `resource_code`), with a 1-click **Clear** button.

### C. DataGrid Readability (Raw IDs vs. Resolved Relation Pills)
- **Issue**: In `EntityDataGrid`, dynamic attribute columns display raw values. For a relation picker field (like `default_policy_id: 301`), it prints raw `301`.
- **Target Resolution**: When an attribute is configured with `uiComponent: 'relation_picker'`, format the grid cell as a distinct relation reference pill (`🔗 #301`) or resolve its label, rather than rendering an unadorned integer.

### D. Dangling Reference & Soft-Delete Handling
- **Issue**: Field-level references (`record.attributes[field] = targetId`) live inside JSONB. If the referenced target record is deleted or archived, the referencing record holds a dangling ID.
- **Target Resolution**: In the ComboBox and preview renderer, gracefully handle unknown/archived IDs by displaying an amber warning indicator (`⚠️ Record #ID not found or archived`) instead of crashing or showing blank state.

### E. Conceptual Separation: Graph Relationships vs. Relation Picker
- **Issue**: Users can get confused between Graph Edges (Tab 3: Relationships & Inspector) and Field Lookups (`relation_picker` attributes). They might create duplicate or conflicting representations without understanding when to use which.
- **Target Resolution**: Add clear contextual in-app guidance in `RelationshipTypesManager` and `AttributeCard` clarifying when to model a connection as a multi-cardinality Graph Edge (1:N, N:N with cascade lifecycle) versus an in-schema attribute lookup (`relation_picker`).

---

## 2. Implementation Deliverables

### Step 1 (Point A): Schema Builder Attribute Dialog Refinement
- **File**: `apps/console/src/features/metadata/components/schema-builder/attribute-dialog.tsx`
- **Actions**:
  1. Relocate `Target Entity Model` selector into the `General & Types` tab.
  2. Conditionally render it immediately when `uiComponent === 'relation_picker'`.
  3. Validate on form submission: block saving if `uiComponent === 'relation_picker'` and no `targetEntityTypeId` is selected.
  4. Automatically clean up `targetEntityTypeId` from `options` if the user changes `uiComponent` to a non-relation component.

### Step 2 (Point B): Searchable ComboBox Component for `RelationPickerControl`
- **File**: `apps/console/src/features/metadata/components/dynamic-fields/dynamic-field-renderer.tsx`
- **Actions**:
  1. Build a searchable ComboBox using `Popover`, `PopoverTrigger`, `PopoverContent`, `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, and `CommandItem`.
  2. Render items with formatted labels (`#ID - Title / Code`), tenant badge, and checkmark.
  3. Include a "Clear selection" option for optional attributes.
  4. Include live record preview badge card below the picker.

### Step 3 (Point C): EntityDataGrid Relation Attribute Formatter
- **File**: `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`
- **Actions**:
  1. Check if the attribute's `uiComponent === 'relation_picker'`.
  2. If so, render a styled relation badge: `🔗 #{id}` with subtle border and icon to distinguish it from regular numerical/text fields.

### Step 4 (Point D): Dangling Reference & Soft-Delete Warning in UI
- **File**: `apps/console/src/features/metadata/components/dynamic-fields/dynamic-field-renderer.tsx`
- **Actions**:
  1. Detect when `value` exists but the target record cannot be resolved among active records (`isDanglingReference`).
  2. Render an amber warning banner: `⚠️ Referenced record #ID was not found or has been archived`.

### Step 5 (Point E): In-App Architectural Guidance for Dual Relationship Models
- **File**: `apps/console/src/features/metadata/components/relationships/relationship-types-manager.tsx`
- **Actions**:
  1. Add an architectural guidance banner at the top of the Relationships tab.
  2. Clarify that Graph Edges manage multi-cardinality (1:1, 1:N, N:1, N:N) lifecycle connections with edge metadata, whereas Field Lookups (`relation_picker`) serve as single foreign reference IDs inside JSON attributes.

---

## 3. Verification & Acceptance Criteria
1. `pnpm --filter @acc/console build` compiles cleanly with zero type errors.
2. Opening `AttributeDialog` and choosing `Relation Picker` shows the Target Entity Model selector directly on the first tab and blocks saving if empty.
3. Editing a record with a `relation_picker` presents a searchable ComboBox that allows typing to filter records and clicking to select or clear.
4. `EntityDataGrid` presents relation attributes as styled reference badges (`🔗 #ID`).
5. Dangling foreign keys render an explicit amber warning badge.
6. Relationships management view displays clear architecture guidance separating Graph Edges from attribute lookups.
