# Walkthrough 119: Universal Monorepo JaCoCo-Style Coverage Generator Script

## Context & Objectives
To unify code coverage reporting across the disparate stacks in the Unipost monorepo (Java 21 Spring Modulith JaCoCo reports in `apps/backend` and TypeScript Vitest v8 Istanbul coverage in `apps/console` and `packages/sandbox`), an interactive, JaCoCo-style HTML coverage generator script was implemented.

---

## Changes

### 1. Unified Coverage Generator Script
- **[`scripts/generate-coverage-report.mjs`](../../scripts/generate-coverage-report.mjs)**:
  - Discovers and parses JaCoCo CSV (`jacoco.csv`) and XML (`jacoco.xml`) from backend target outputs.
  - Discovers and parses Vitest / Istanbul JSON coverage (`coverage-final.json`) from `apps/console` and `packages/sandbox`.
  - Normalizes metrics into a unified JaCoCo-style model:
    - Instructions / Statements (Missed vs Covered)
    - Branches (Missed vs Covered)
    - Lines (Missed vs Covered)
    - Methods / Functions (Missed vs Covered)
    - Files / Classes count
  - Generates a standalone, self-contained, responsive single-page HTML report at `coverage/index.html`.
  - Includes:
    - Classic JaCoCo horizontal Red/Green meters for all metrics.
    - Breadcrumbs navigation (`unipost > @unipost/backend > com.unipost.service > DynamicQueryCompiler`).
    - Top KPI summary dashboard cards with color-coded badges ($\ge 90\%$ Pass, 70-89% Warning, $< 70\%$ Critical).
    - Module selector tabs: `[All Monorepo]`, `[@unipost/backend]`, `[@unipost/console]`, `[@unipost/sandbox]`.
    - Real-time search filter input across all packages and files.
    - Click-to-sort columns (Element, Instructions, Branches, Lines, Methods, Classes).
    - Drill-down navigation: Root -> Module -> Package -> File.
    - Interactive slide-out Source Code Viewer with line numbers and coverage highlights (green for covered, yellow for partial, red for uncovered).
    - Dual theme support: Modern Liquid Glass Dark mode and Classic JaCoCo Light mode.
    - Dual View Mode switcher: `📁 Hierarchy` (Drill-down: Monorepo -> Module -> Package -> File) vs `📄 All Files (217 files)` (Flat instant searchable listing of every file in the project).
    - Real source code viewer rendering actual source lines with line numbers and JaCoCo coverage color classes.
    - CLI flags: `--open` (opens in browser), `--run` (runs all coverage suites before generating), `--json` (exports `coverage-summary.json`), and `--out` (custom path).

### 2. Root NPM Scripts
- **[`package.json`](../../package.json)**:
  - `"coverage:report"`: Runs `node scripts/generate-coverage-report.mjs`.
  - `"coverage:open"`: Runs generator and automatically opens `coverage/index.html` in the default browser.
  - `"coverage:all"`: Executes all coverage suites and opens the resulting report.

---

## Verification Results

1. **Script Execution**:
   - Running `pnpm coverage:report` parsed all 217 files/classes across 3 modules in under 1 second.
   - Aggregate metrics:
     - Total Files: 217
     - Statements / Instructions: 23,178 / 28,214 (82.2%)
     - Branches: 4,279 / 8,090 (52.9%)
     - Line Coverage: 29,210 / 31,041 (94.1%)
     - Functions / Methods: 1,279 / 2,348 (54.5%)
2. **HTML Artifact**:
   - `coverage/index.html` generated cleanly with zero external CDN dependencies.
   - Fully viewable offline and directly from the local filesystem via `file:///` URLs.
