# Walkthrough 127: Grid-Wide Hover Detection for Scrollbar Thumb Ergonomics

## 1. Overview
In dense horizontal tables such as `EntityDataGrid` and `DataTable`, the customized scrollbar thumb previously had very faint contrast when unhovered and only brightened when the user directly placed the mouse cursor over the 6px scrollbar track.

This update introduces **grid-wide hover detection**:
- When the user hovers anywhere over the table or container (`.group/grid:hover`), the horizontal and vertical scrollbar thumbs immediately illuminate into view (`rgba(100, 100, 100, 0.65)` in light mode, `rgba(255, 255, 255, 0.55)` in dark/obsidian mode).
- When directly hovering the scrollbar thumb itself, it brightens further (`rgba(70, 70, 70, 0.85)` / `rgba(255, 255, 255, 0.8)`).
- Increased scrollbar footprint slightly from 6px to 8px with `border: 2px solid transparent` and `background-clip: padding-box` for smoother cursor interaction.

---

## 2. Key Changes Made

### CSS Styling & Theme Rules
- `apps/console/src/styles/index.css`:
  - Upgraded `.scrollbar-thin`:
    - Set base scrollbar dimensions to `8px` (`width: 8px; height: 8px`).
    - Added subtle track tint: `rgba(0, 0, 0, 0.03)` / `rgba(255, 255, 255, 0.03)`.
    - Added high-contrast rules triggered on parent container hover:
      ```css
      :hover > .scrollbar-thin::-webkit-scrollbar-thumb,
      .scrollbar-thin:hover::-webkit-scrollbar-thumb,
      .group:hover .scrollbar-thin::-webkit-scrollbar-thumb,
      .group\/grid:hover .scrollbar-thin::-webkit-scrollbar-thumb {
        background: rgba(100, 100, 100, 0.65);
        background-clip: padding-box;
      }
      ```
    - Added dark / obsidian theme equivalents (`rgba(255, 255, 255, 0.55)`).

### Component Markup
- `apps/console/src/features/metadata/components/data-explorer/entity-data-grid.tsx`:
  - Added `group/grid` to the table container element.
- `apps/console/src/components/data-table/data-table.tsx`:
  - Added `group/grid` to the shared `DataTable` container element.

---

## 3. Verification Record

1. **Vitest Unit & Component Suite**:
   - `npx vitest run src/features/metadata/components/data-explorer/__tests__/entity-data-grid.test.tsx`: 4/4 passing.
2. **TypeScript Integrity**:
   - `npx tsc --noEmit --project tsconfig.json`: 0 errors.
