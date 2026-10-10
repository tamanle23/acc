# Design Specification: Console (`@unipost/console`)
> **Target Tool / Feed:** Google Stitch AI Design Canvas & Antigravity Agents  
> **Aesthetic System:** Liquid Glass Enterprise Design Language  
> **Platform:** Responsive Web (Vite 8 / React 19) & Desktop Companion (Electrobun)  
> **Status:** Living Document & Foundation Specification

---

## 1. System Identity & Vision

### 1.1 Product Purpose & Persona
`@unipost/console` is an enterprise-grade administration, operations, and cloud resource management portal. It is used by DevOps leads, system administrators, and engineering managers who need high information density, low latency, and crystal-clear visual hierarchies.

### 1.2 Aesthetic Core: Liquid Glass Enterprise
The visual identity departs from flat, opaque enterprise dashboards by implementing **Liquid Glass**:
- Optical translucency with multi-layered frosted backdrops over subtle chromatic mesh caustics.
- Specular glass borders with top/inset lighting reflections.
- Elevated floating card hierarchy with diffuse ambient shadows.
- Configurable **Glass Intensity** (`0.0` to `1.0`), allowing users to tune glass translucency from ultra-frosted to subtle crisp scrims.

---

## 2. Google Stitch Portable Design Tokens

Google Stitch ingests these design tokens as prompt-level constraints when rendering screens.

### 2.1 Color Palette (OKLCH & CSS Custom Properties)

| Semantic Token | Light Mode Value | Dark Mode Value | Usage Description |
| :--- | :--- | :--- | :--- |
| `--background` | `oklch(0.985 0.005 250)` | `oklch(0.12 0.035 264.695)` | Deep canvas background under frosted scrims |
| `--foreground` | `oklch(0.129 0.042 264.695)` | `oklch(0.984 0.003 247.858)` | High-contrast primary text |
| `--card` | `oklch(1 0 0 / 45%)` | `oklch(0.16 0.035 259.21 / 45%)` | Translucent glass card surface fill |
| `--card-foreground` | `oklch(0.129 0.042 264.695)` | `oklch(0.984 0.003 247.858)` | Text and icons inside glass cards |
| `--popover` | `oklch(1 0 0 / 75%)` | `oklch(0.18 0.038 265.755 / 75%)` | Floating dropdown, dialog & menu background |
| `--primary` | `oklch(0.208 0.042 265.755)` | `oklch(0.929 0.013 255.508)` | Primary action buttons, active navigation indicator |
| `--primary-foreground` | `oklch(0.984 0.003 247.858)` | `oklch(0.208 0.042 265.755)` | Text on primary interactive buttons |
| `--secondary` | `oklch(0.968 0.007 247.896 / 70%)` | `oklch(0.25 0.035 260.031 / 55%)` | Secondary buttons, subtle pill badges |
| `--muted` | `oklch(0.968 0.007 247.896 / 50%)` | `oklch(0.25 0.035 260.031 / 45%)` | Neutral background fill for inactive elements |
| `--muted-foreground` | `oklch(0.554 0.046 257.417)` | `oklch(0.704 0.04 256.788)` | Secondary helper text, timestamps, labels |
| `--accent` | `oklch(0.968 0.007 247.896 / 60%)` | `oklch(0.25 0.035 260.031 / 50%)` | Interactive hover states on table rows/nav |
| `--destructive` | `oklch(0.577 0.245 27.325)` | `oklch(0.704 0.191 22.216)` | Critical alerts, delete buttons, error badges |
| `--border` | `oklch(0.9 0.015 255 / 45%)` | `oklch(1 0 0 / 14%)` | Divider rules, card boundaries |
| `--ring` | `oklch(0.704 0.04 256.788)` | `oklch(0.551 0.027 264.364)` | Accessibility keyboard focus rings |

### 2.2 Liquid Glass Tokens

```css
/* Light Mode Liquid Glass Variables */
--glass-bg: oklch(1 0 0 / calc(0.15 + var(--glass-intensity, 0.2) * 0.5));
--glass-border: rgba(255, 255, 255, calc(0.15 + var(--glass-intensity, 0.2) * 0.45));
--glass-specular: rgba(255, 255, 255, var(--glass-specular-alpha, 0.85));
--glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.06);

/* Dark Mode Liquid Glass Variables */
--glass-bg: oklch(0.14 0.035 264 / calc(0.18 + var(--glass-intensity, 0.2) * 0.5));
--glass-border: rgba(255, 255, 255, calc(0.06 + var(--glass-intensity, 0.2) * 0.2));
--glass-specular: rgba(255, 255, 255, calc(var(--glass-specular-alpha, 0.2) * 0.65));
--glass-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);

/* Sovereign Amber Liquid Glass Tokens (Assume-Tenant & Custody Badges) */
--glass-amber-bg: rgba(245, 158, 11, 0.15);
--glass-amber-border: rgba(245, 158, 11, 0.35);
--glass-amber-specular: rgba(254, 243, 199, 0.65);
--glass-amber-shadow: 0 4px 20px 0 rgba(245, 158, 11, 0.12);
```

- **Backdrop Blur Levels:**
  - Panels & Sticky Bars: `backdrop-blur-2xl` (40px)
  - Cards & Modals: `backdrop-blur-xl` (24px)
  - Tooltips & Flyouts: `backdrop-blur-md` (12px)
- **Specular Inset Highlight:**
  - Light: `shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)]`
  - Dark: `shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]`

### 2.3 Typography Scale
- **Display / Headers:** `Manrope`, sans-serif (weights: 600 SemiBold, 700 Bold)
- **Body & Data:** `Inter`, sans-serif (weights: 400 Regular, 500 Medium, 600 SemiBold)
- **Scale:**
  - Hero / KPI Stat: `32px` / `line-height: 40px` / `font-bold`
  - Page Title (H1): `24px` / `line-height: 32px` / `font-semibold`
  - Section Title (H2): `18px` / `line-height: 26px` / `font-semibold`
  - Card Title (H3): `15px` / `line-height: 22px` / `font-medium`
  - Body Base: `14px` / `line-height: 20px` / `font-normal`
  - Micro / Meta / Caption: `12px` / `line-height: 16px` / `font-medium`

### 2.4 Corner Radii & Elevation
- Base radius: `--radius: 0.75rem` (`12px`)
- Card surface: `rounded-2xl` (`16px`)
- Inner widgets / inputs: `rounded-xl` (`12px`)
- Badges / chips: `rounded-full` (`9999px`)
- Elevation:
  - Base Card: `shadow-lg shadow-black/5 dark:shadow-black/25`
  - Floating Popover/Dialog: `shadow-2xl shadow-black/10 dark:shadow-black/40`

---

## 3. Core Component Library Specifications

### 3.1 Glass Card (`GlassCard`)
- **Container Style:** `bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 shadow-lg shadow-black/5 dark:shadow-black/30 rounded-2xl`
- **Inner Padding:** Standard `p-6`, compact `p-4`
- **Header:** Title + subtitle + right action slot (button / dropdown menu)
- **Content:** Data metrics, charts, or tabular listings.

### 3.2 Liquid Glass Sidebar Navigation (`AppSidebar`)
- **Container Style:** `bg-white/50 dark:bg-slate-950/50 backdrop-blur-2xl border-r border-white/20 dark:border-white/10`
- **Team Switcher:** Popover button with organization avatar + plan badge at the top.
- **Nav Item States:**
  - *Inactive:* `text-muted-foreground hover:bg-white/30 dark:hover:bg-white/5 hover:text-foreground transition-all duration-150`
  - *Active:* `bg-primary text-primary-foreground shadow-md shadow-primary/20 font-medium`
  - *Badge:* Pill with count or state (`bg-secondary text-secondary-foreground text-xs px-2 py-0.5 rounded-full`)

### 3.3 Data Table Component (`DataTable`)
- **Header:** Sticky frosted row (`bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground`)
- **Row Interaction:** Subtle hover glass highlight (`hover:bg-white/40 dark:hover:bg-white/5 transition-colors`)
- **Pagination & Filters:** Floating bottom glass toolbar with page index, page size selector, and column visibility toggle.

### 3.4 Liquid Button (`GlassButton` / `Button`)
- **Primary:** `bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all active:scale-98`
- **Glass Variant:** `bg-white/20 hover:bg-white/30 dark:bg-white/10 dark:hover:bg-white/15 border border-white/30 dark:border-white/15 backdrop-blur-md shadow-sm active:scale-95`
- **Destructive:** `bg-destructive/15 text-destructive hover:bg-destructive/25 border border-destructive/30`

### 3.5 Metadata SchemaBuilder & Dynamic Data Explorer
- **Entity Model Sidebar:** `w-full lg:w-72 bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-2xl shadow-lg` with active selection item `bg-primary text-primary-foreground font-semibold shadow-md shadow-primary/20`.
- **Attribute Card:** `bg-white/45 dark:bg-slate-900/45 backdrop-blur-xl border border-white/30 dark:border-white/10 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-white/50 transition-all` with monospace system key badges and icon container `bg-primary/10 text-primary border border-primary/20`.
- **Dynamic Field Inputs:** `bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm border-white/20 focus:border-primary` with WCAG AA compliant contrast.
- **Data Table Canvas:** Translucent table container `backdrop-blur-xl bg-white/45 dark:bg-slate-900/45 border border-white/30 dark:border-white/10 rounded-2xl shadow-lg` with sticky header `bg-white/60 dark:bg-slate-800/60` and hover rows `hover:bg-white/40 dark:hover:bg-white/5`.

### 3.6 Multi-Tenant Billing & FinOps Suite (`/settings/billing`)
- **Subscription Overview Card:** `bg-white/50 dark:bg-slate-900/50 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-xl shadow-black/5 rounded-3xl p-6` with active tier specular badges and live quota progress gauges.
- **4-Tier Pricing Grid:** 4-column responsive grid (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4`) with popular highlight `ring-2 ring-blue-500/40 bg-blue-500/15` and annual discount pill `-20%`.
- **VietQR Transaction Ledger:** Translucent table container `bg-white/40 dark:bg-white/5 backdrop-blur-xl border border-white/20 dark:border-white/10 rounded-2xl` with localized timestamps and Napas247 receipt download actions.
- **Corporate E-Invoice Form:** Vietnamese VAT compliance panel with monospace tax code (MST) input and auto-invoice dispatch toggle.

---

## 4. Google Stitch Prompting Blueprint (Zoom-Out-Zoom-In)

When instructing **Google Stitch** to generate or iterate screens for `@unipost/console`, use this structured formula:

```markdown
### STITCH GENERATION TEMPLATE: `@unipost/console`

[1. CONTEXT]
Design an enterprise administration dashboard screen for "@unipost/console".
Audience: DevOps engineers, system admins, engineering leaders.
Vibe: Ultra-modern, high-density, professional "Liquid Glass" enterprise aesthetics.

[2. PLATFORM CONSTRAINTS]
Desktop and tablet responsive web app (1440px canvas).
Framework: React 19 + Tailwind CSS v4.
Strict Rule: NO flat opaque grey/white boxes. Every card and panel MUST use frosted optical translucency.

[3. LAYOUT & GLASS TOKENS]
- Background: Deep slate mesh canvas with subtle ambient blue/indigo blur caustics behind glass surfaces.
- Sidebar: Left frosted navigation rail (260px wide, backdrop-blur-2xl, border-r border-white/20).
- Sticky Header: Top frosted breadcrumb bar with search command (cmdk), notification bell with badge, and profile glass dropdown.
- Card Style: backdrop-blur-xl bg-white/45 dark:bg-slate-900/45 border border-white/30 dark:border-white/10 rounded-2xl shadow-lg.
- Typography: Manrope for headings, Inter for numerical values and table records.

[4. SCREEN SPECIFICS: <INSERT SCREEN NAME>]
- Hero KPI Metrics: 4 summary glass cards (Total Active Nodes, Error Rate %, Latency p99, Storage Quota).
- Main Center: Interactive line/area telemetry chart with translucent gradient fill.
- Bottom Split: Left = Recent Audit Events table; Right = Active Cloud Services status list.
- Interaction States: Show subtle hover sheens on cards and buttons.
```

---

## 5. Accessibility & Responsive Breakpoints

- **Contrast:** Scrim opacity is maintained at >= 45% in light mode and >= 50% in dark mode to guarantee WCAG AA text contrast ratio (>= 4.5:1).
- **Responsive Breakpoints:**
  - `sm`: `640px` (Mobile Drawer for Sidebar)
  - `md`: `768px` (Tablet Collapsible Rail)
  - `lg`: `1024px` (Full Sidebar Expanded)
  - `xl`: `1280px` (Multi-column Dashboard Grid)
  - `2xl`: `1536px` (Wide Enterprise Monitor Layout)
- **Reduced Motion:** If `prefers-reduced-motion: reduce`, disable mesh gradient animations and hover scale transformations.
