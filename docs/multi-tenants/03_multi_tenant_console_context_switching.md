# Part 3: Console UI Dynamic Context Switching Specification (Admin vs. Operator Mode)

**Series:** Multi-Tenant Architecture Blueprint Series (Document 03 of N)  
**Document Level:** Front-End Architecture & UI/UX Interaction Specification  
**Target Systems:** `@acc/console` (React 19 / Vite 8 / TanStack Router / Zustand / Tailwind v4)  
**Scope:** Dual-Mode Workspace (`Architect Mode` vs. `Operator Mode`), Permission-Based Route & Tab Guards, Dynamic Liquid Glass Forms, Seamless Dogfooding  
**Status:** Canonical Living Architecture Document  

---

## 1. Executive Summary & Design Rationale

In our multi-tenant dynamic metadata architecture, a tenant's authorized users will access the platform in two fundamentally distinct capacities:
1. **Tenant Admin (Schema Architect)**: Defines business models, crafts attribute schemas, specifies Draft-07 validation rules, and designs Pattern C relationship graphs.
2. **Tenant User (Operational Specialist)**: Performs day-to-day operations—entering orders, querying data grids, viewing graph linkages, and generating exports—without touching underlying schema definitions.

A critical design challenge is that **Tenant Administrators frequently need to test ("dogfood") their newly configured schemas** from the perspective of an everyday operator without the friction of logging out, switching credentials, or opening incognito browsers.

`@acc/console` addresses this by introducing a **Dynamic Workspace Mode Context Switcher**:
* **`Architect Mode`**: Full metadata modeling studio, schema builders, and edge type managers.
* **`Operator Mode`**: Clutter-free operational canvas presenting dynamically generated Liquid Glass forms and server data grids.

---

## 2. Dual Workspace Mode Comparison Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              @acc/console WORKSPACE MODES                          │
├────────────────────────────────┬───────────────────────────────────────────────────────┤
│ 🛠️ Architect Mode (Admin)      │ 👤 Operator Mode (User)                               │
├────────────────────────────────┼───────────────────────────────────────────────────────┤
│ Focus: Data Structure Modeling │ Focus: Operational Record Processing                  │
│                                │                                                       │
│ • Tabs: [Schema Builder]       │ • Tabs: [Data Explorer]                               │
│         [Data Explorer]        │         [Connected Edges]                             │
│         [Connected Edges]      │ (Schema Builder tab hidden)                           │
│                                │                                                       │
│ • Left Rail: [+ New Model]     │ • Left Rail: Read-only entity model navigation        │
│   Full Model Edit/Delete Menu  │   No model mutation controls                          │
│                                │                                                       │
│ • Data Explorer Grid Actions:  │ • Data Explorer Grid Actions:                         │
│   [+ New Record]               │   [+ New Record]                                      │
│   [🛠️ Customize Schema]        │   [📥 Export CSV]                                     │
│   [👁️ View JSON Schema]        │                                                       │
│                                │                                                       │
│ • Record Editor Dialog:        │ • Record Editor Dialog:                               │
│   Inspect technical attributes │   Clean Liquid Glass form inputs with user-friendly   │
│   (system_name, type, regex)   │   labels, placeholders, and error messages            │
│   🔒 System Locked vs ✏️ Custom │   Uniform rendering across system and custom fields   │
└────────────────────────────────┴───────────────────────────────────────────────────────┘
```

---

## 3. UI/UX Visual Layouts & Wireframes
*(Cross-Reference: Document 07 for System vs. Tenant Attributes)*

### 3.1 Architect Mode (Header & Workspace Canvas)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Unipost   🏢 ACME Global (Tenant)      [ 🛠️ Mode: Architect 🔘 ]  [👤 Admin]   │
├──────────────────┬─────────────────────────────────────────────────────────────────────┤
│ Entity Models    │ 🏢 Customer Account  (ent_customer_acc)  [System Model + Custom]    │
│ [+] New Model    │ [ Layers Schema Builder ]  [ ⛁ Data Explorer ]  [ ᛦ Connected Edges ] │
│ ──────────────── ┼─────────────────────────────────────────────────────────────────────┤
│ 🏢 Customer Acc  │  + Add Custom Attribute | 👁️ View Composite Schema | 🔒 System Protected│
│ ☁️ Cloud Node    │ ─────────────────────────────────────────────────────────────────── │
│ 📦 Shipment Spec │  🔒  Legal Name (legal_name)            [STRING] [Required] [SYSTEM]│
│                  │  🔒  Tax Number (vat_id)                [STRING] [Optional] [SYSTEM]│
│                  │  ✏️  Cost Center (cost_center)          [STRING] [Optional] [CUSTOM]│
└──────────────────┴─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Operator Mode (Instant Dogfooding & Standard User View)
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [Logo] Unipost   🏢 ACME Global (Tenant)      [ 👤 Mode: Operator ⚪ ]  [👤 Admin]    │
├──────────────────┬─────────────────────────────────────────────────────────────────────┤
│ Business Entities│ 🏢 Customer Accounts                                                │
│ [Search Models]  │ [ ⛁ Data Explorer ]  [ ᛦ Connected Edges ]                         │
│ ──────────────── ┼─────────────────────────────────────────────────────────────────────┤
│ 🏢 Customer Acc  │  + New Customer Account  |  🔍 Search Records...  |  📥 Export CSV  │
│ ☁️ Cloud Node    │ ─────────────────────────────────────────────────────────────────── │
│ 📦 Shipment Spec │  [ ID ] [ Company Legal Name ]    [ VAT Number ]   [ Status ]       │
│                  │  #101   Acme Industrial Corp      US-99120412      Active    [...]  │
│                  │  #102   Vertex Global Logistics   DE-88210301      Pending   [...]  │
└──────────────────┴─────────────────────────────────────────────────────────────────────┘
```

---

## 4. Zustand State Store Architecture (`use-metadata-ui-store.ts`)

The metadata UI store is augmented with role inspection, tenant context, and active workspace mode switching:

```typescript
// apps/console/src/features/metadata/store/use-metadata-ui-store.ts

export type WorkspaceMode = 'architect' | 'operator';
export type TenantRole = 'TENANT_ADMIN' | 'TENANT_OPERATOR' | 'TENANT_VIEWER';

interface MetadataUiState {
  // Navigation & Model Selection
  selectedEntityTypeId: string | null;
  setSelectedEntityTypeId: (id: string | null) => void;
  activeTab: 'schema' | 'data' | 'relationships';
  setActiveTab: (tab: 'schema' | 'data' | 'relationships') => void;

  // Multi-Tenant Context & RBAC
  activeTenantId: string;
  activeTenantName: string;
  currentUserRole: TenantRole;
  workspaceMode: WorkspaceMode;

  // Actions
  setWorkspaceMode: (mode: WorkspaceMode) => void;
  toggleWorkspaceMode: () => void;
  
  // Computed Permission Selectors
  canManageSchema: () => boolean;
  canMutateRecords: () => boolean;
}

export const useMetadataUiStore = create<MetadataUiState>((set, get) => ({
  selectedEntityTypeId: null,
  setSelectedEntityTypeId: (id) => set({ selectedEntityTypeId: id }),
  activeTab: 'data',
  setActiveTab: (tab) => set({ activeTab: tab }),

  activeTenantId: 'tenant-default',
  activeTenantName: 'Default Organization',
  currentUserRole: 'TENANT_ADMIN',
  workspaceMode: 'architect',

  setWorkspaceMode: (mode) => {
    const { currentUserRole, activeTab } = get();
    // Non-admins can NEVER switch to architect mode
    if (currentUserRole !== 'TENANT_ADMIN' && mode === 'architect') {
      return;
    }
    // If switching to operator mode while on schema tab, fallback safely to data tab
    const nextTab = (mode === 'operator' && activeTab === 'schema') ? 'data' : activeTab;
    set({ workspaceMode: mode, activeTab: nextTab });
  },

  toggleWorkspaceMode: () => {
    const { workspaceMode, setWorkspaceMode } = get();
    setWorkspaceMode(workspaceMode === 'architect' ? 'operator' : 'architect');
  },

  canManageSchema: () => {
    const { currentUserRole, workspaceMode } = get();
    return currentUserRole === 'TENANT_ADMIN' && workspaceMode === 'architect';
  },

  canMutateRecords: () => {
    const { currentUserRole } = get();
    return currentUserRole !== 'TENANT_VIEWER';
  },
}));
```

---

## 5. Main Stage Component Implementation (`metadata-feature.tsx`)

In `apps/console/src/features/metadata/components/metadata-feature.tsx`, we enforce adaptive rendering of tabs, toolbars, and mode controls:

```tsx
export const MetadataFeature: React.FC = () => {
  const { t } = useTranslation('console');
  const {
    activeTab,
    setActiveTab,
    workspaceMode,
    toggleWorkspaceMode,
    currentUserRole,
    canManageSchema,
  } = useMetadataUiStore();

  return (
    <Main>
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 backdrop-blur-md bg-white/40 dark:bg-slate-900/40">
        
        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)}>
          <TabsList className="bg-white/60 dark:bg-slate-800/60 backdrop-blur-xl border border-white/30">
            {/* Schema Builder is ONLY visible in Architect Mode */}
            {canManageSchema() && (
              <TabsTrigger value="schema" className="gap-2">
                <Layers className="h-4 w-4 text-amber-500" />
                <span>{t('tabs.schemaBuilder', 'Schema Builder')}</span>
              </TabsTrigger>
            )}

            <TabsTrigger value="data" className="gap-2">
              <Database className="h-4 w-4 text-emerald-500" />
              <span>{t('tabs.dataExplorer', 'Data Explorer')}</span>
            </TabsTrigger>

            <TabsTrigger value="relationships" className="gap-2">
              <GitFork className="h-4 w-4 text-blue-500" />
              <span>{t('tabs.connectedEdges', 'Connected Edges')}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Architect / Operator Mode Switcher (Visible to Admins Only) */}
        {currentUserRole === 'TENANT_ADMIN' && (
          <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-white/60 dark:bg-slate-800/60 border border-white/30 backdrop-blur-xl shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {workspaceMode === 'architect' ? (
                <span className="text-amber-500 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Architect Studio
                </span>
              ) : (
                <span className="text-emerald-500 flex items-center gap-1.5">
                  👤 Operator View
                </span>
              )}
            </span>
            <Switch
              checked={workspaceMode === 'architect'}
              onCheckedChange={toggleWorkspaceMode}
              aria-label="Toggle Architect Mode"
            />
          </div>
        )}
      </div>

      {/* Main Stage Canvas: Displays SchemaBuilder, EntityDataGrid, or Relationships */}
      <div className="flex-1 p-6">
        {activeTab === 'schema' && canManageSchema() && <SchemaBuilder />}
        {activeTab === 'data' && <EntityDataGrid />}
        {activeTab === 'relationships' && <RelationshipTypesManager />}
      </div>
    </Main>
  );
};
```

---

## 6. Left Rail Sidebar Adaptation (`entity-type-sidebar.tsx`)

In `entity-type-sidebar.tsx`, model management actions (`+ New Model`, `Edit Model`, `Delete Model`) are conditionally mounted based on `canManageSchema()`:

1. **New Model Button**:
   * If `canManageSchema() == true`: Renders the `+ (New Model)` icon button and triggers the creation modal.
   * If `canManageSchema() == false`: The button is omitted; search bar expands to full width.
2. **Contextual Three-Dot Actions (`...`)**:
   * In `Architect Mode`: Menu offers `Edit Model Name`, `Change System Identifier`, and `Delete Model`.
   * In `Operator Mode`: Three-dot menu is omitted; clicking the item directly selects the model for the Data Explorer.

---

## 7. Dynamic Form & Record Editor Adaptation

When creating or editing a record via `<RecordEditorDialog />`:
* **Operator View**: Focuses entirely on business usability. Field inputs are rendered using Liquid Glass tokens (`backdrop-blur-xl bg-white/65 border-white/30`), with clear validation messages derived from the JSON Schema.
* **Architect View**: Form fields include an optional "Inspect Field Schema" badge displaying technical attributes (`system_name: legal_name`, `dataType: STRING`, `required: true`). Admins can click a wrench icon to jump straight into editing that attribute definition in the Schema Builder.

---

## 8. Summary of Architectural Benefits

1. **Instant Feedback Loop**: Admins can configure an entity and immediately toggle to Operator Mode to verify validation UX, ComboBox behavior, and grid filters.
2. **Zero Route Disorientation**: URL state preserves the selected model (`?model=ent_customer_acc`), allowing smooth mode transitions without resetting the active entity.
3. **Role-Enforced Security**: Even if a standard user tries to force the state via dev tools, backend Spring Security and PostgreSQL RLS reject unauthorized schema writes.
