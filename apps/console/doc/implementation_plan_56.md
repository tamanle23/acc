# Implementation Plan 56 - Adaptive Tab Layout UI/UX Enhancement (Option A)

Enhance the Adaptive Tab Layout in the Metadata Management Module with an intuitive, segmented frosted-glass rail featuring dynamic entity metrics/badges, distinct active tab elevation, and clear navigational affordance.

---

## 1. Problem Statement & Motivation
- **Low Visual Affordance**: The tab selector currently shares similar styling with filter buttons and sits inside the model banner without a distinct structural role, making it difficult for users to recognize it as the main workspace navigation controller.
- **Lack of Information Density**: Users cannot see at a glance how many fields, records, or relationships exist in the current model without clicking each tab.
- **Visual Disconnect from Canvas**: The active tab lacks an active anchor/indicator linking it clearly to the loaded tab canvas.

---

## 2. Proposed UI/UX Architecture (Option A)

### Visual Hierarchy & Structural Layout
1. **Model Header Banner (Streamlined)**:
   - Displays the entity model name, icon badge, system key, description, and quick metadata stats.
   - Houses the new high-affordance **Segmented Frosted Glass Rail**.

2. **Segmented Frosted Glass Tab Rail**:
   - Distinct container styling: `p-1.5 rounded-xl bg-slate-150/70 dark:bg-slate-950/60 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-inner shadow-black/5`.
   - On **Mobile (`< sm`)**: Full-width auto-balanced grid (`grid grid-cols-3 w-full`), ensuring equal 33.3% share with icons and compact count badges.
   - On **Desktop (`>= sm`)**: Elegant auto-width inline tab strip (`sm:inline-flex sm:w-auto`).

3. **High-Affordance Tab Triggers**:
   - **Active State**:
     - Elevated frosted pill: `data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800` with subtle glow `data-[state=active]:shadow-md data-[state=active]:shadow-primary/10`.
     - Active bottom glow indicator or border accent (`data-[state=active]:border-primary/40`).
     - Distinct typography: `font-semibold text-foreground`.
   - **Hover / Inactive State**:
     - `text-muted-foreground hover:text-foreground hover:bg-white/40 dark:hover:bg-white/5 transition-all`.
   - **Dynamic Counter Badges**:
     - **Schema Builder**: Live count of active attributes (e.g., `12 fields`).
     - **Data Explorer**: Live count of records (e.g., `145 records`).
     - **Connected Edges**: Live count of relationships attached to this model (e.g., `3 edges`).
     - Badges automatically highlight with a primary tint when their tab is active (`data-[state=active]:bg-primary/10 data-[state=active]:text-primary`).

---

## 3. Step-by-Step Execution Plan

### Step 1: Query Metric Hooks in MetadataFeature
- Fetch attribute definitions count: `useAttributeDefinitions(selectedEntityTypeId, { size: 1 })` -> `attributesResponse?.totalElements`.
- Fetch record count: `useEntityRecords(selectedEntityTypeId, { size: 1 })` -> `recordsResponse?.totalElements`.
- Fetch relationships count: `useRelationshipTypes()` -> count filtering `sourceEntityTypeId === selectedEntityTypeId || targetEntityTypeId === selectedEntityTypeId`.

### Step 2: Redesign Tab Selector in `metadata-feature.tsx`
- Replace plain `<TabsList>` and `<TabsTrigger>` styling with:
  - High-contrast segmented rail tokens (`bg-slate-100/80 dark:bg-slate-900/80 ring-1 ring-black/5 dark:ring-white/10`).
  - Active pill elevation (`data-[state=active]:bg-white dark:data-[state=active]:bg-slate-800/95 data-[state=active]:shadow-md data-[state=active]:shadow-black/5`).
  - Integrated dynamic badge pills (`ml-2 px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium`).
  - Mobile responsiveness: icons + labels on desktop, icon + badge count on compact view, with tooltips or truncate safeguards.

### Step 3: Verify Visual & Interaction Ergonomics
- Test tab switching, URL query param persistence (`?tab=schema|data|relationships`), and keyboard navigation.
- Verify responsiveness from mobile viewport (320px) to desktop (1920px).

### Step 4: Verification & Acceptance Criteria
- Run Vitest suite: `pnpm --filter @acc/console test`.
- Run production build: `pnpm --filter @acc/console build`.
- Check git diff and commit changes.
