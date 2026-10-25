# Design Specification: Tekgo UI (`tekgo-ui`)
> **Target Tool / Feed:** Google Stitch AI Design Canvas & Antigravity Agents  
> **Aesthetic System:** Liquid Glass Editorial Design Language  
> **Platform:** Responsive Web & Content Hub (Next.js 15 App Router / React 19)  
> **Status:** Living Document & Foundation Specification

---

## 1. System Identity & Vision

### 1.1 Product Purpose & Persona
`tekgo-ui` is the technical publication, knowledge hub, and engineering blog platform for acc. Its audience includes software engineers, researchers, and systems architects reading long-form technical content, reviewing code architectures, and discovering open-source releases.

### 1.2 Aesthetic Core: Liquid Glass Editorial
The visual design combines high-readability typography with **Liquid Glass Editorial** accents:
- **Translucent Reading Architecture:** Sticky frosted header with `backdrop-blur-2xl` that floats over long-form prose without obscuring progress.
- **Translucent Content Cards:** Glass cards for projects, articles, and author bios with subtle specular borders.
- **Ambient Chromatic Glow:** Subtle mesh gradient blooms behind hero sections and article titles.
- **Glass Popovers & Command Palette:** Frosted overlays for search (KBar), theme menus, and mobile hamburger navigation.

---

## 2. Google Stitch Portable Design Tokens

Google Stitch ingests these design tokens when generating editorial pages, blog layouts, and interactive content cards.

### 2.1 Color Palette (OKLCH & Tailwind CSS v4)

| Semantic Token | OKLCH Value | Role Description |
| :--- | :--- | :--- |
| `--color-primary-50` | `oklch(0.971 0.014 343.198)` | Very light tinted background chips |
| `--color-primary-500`| `oklch(0.656 0.241 354.308)` | Vibrant magenta/violet brand accent |
| `--color-primary-600`| `oklch(0.592 0.249 0.584)` | Hover state for buttons and links |
| `--color-gray-50` | `oklch(0.985 0.002 247.839)` | Light page background |
| `--color-gray-100` | `oklch(0.967 0.003 264.542)` | Frosted card light scrim |
| `--color-gray-800` | `oklch(0.278 0.033 256.848)` | Subdued dark borders |
| `--color-gray-900` | `oklch(0.210 0.034 264.665)` | Dark card backdrop |
| `--color-gray-950` | `oklch(0.130 0.028 261.692)` | Deep canvas background in dark mode |

### 2.2 Editorial Liquid Glass Tokens

```css
/* Sticky Navigation Bar */
.glass-header {
  background-color: rgb(255 255 255 / 0.50);
  backdrop-filter: blur(40px);
  border-bottom: 1px solid rgb(255 255 255 / 0.20);
}
.dark .glass-header {
  background-color: rgb(2 6 23 / 0.50);
  backdrop-filter: blur(40px);
  border-bottom: 1px solid rgb(255 255 255 / 0.10);
}

/* Glass Article & Project Card */
.glass-card {
  background-color: rgb(255 255 255 / 0.65);
  backdrop-filter: blur(24px);
  border: 1px solid rgb(255 255 255 / 0.30);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.05);
}
.dark .glass-card {
  background-color: rgb(15 23 42 / 0.65);
  backdrop-filter: blur(24px);
  border: 1px solid rgb(255 255 255 / 0.10);
  box-shadow: 0 10px 25px -5px rgb(0 0 0 / 0.30);
}
```

### 2.3 Typography Scale (Editorial Hierarchy)
- **Headings & Brand:** `Space Grotesk`, sans-serif (weights: 600 SemiBold, 700 Bold)
- **Prose & Body:** System Sans / ui-sans-serif, optimized for extended reading
- **Code:** Monospace with syntax highlighting via `prism.css`
- **Scale:**
  - Hero Title: `48px - 60px` / `line-height: 1.1` / `font-extrabold tracking-tight`
  - Article H1: `36px - 40px` / `line-height: 1.2` / `font-bold`
  - Section H2: `28px` / `line-height: 1.3` / `font-semibold`
  - Subsection H3: `22px` / `line-height: 1.4` / `font-semibold`
  - Body Prose: `18px` / `line-height: 1.75` / `text-gray-700 dark:text-gray-300`
  - Tag / Meta: `13px` / `line-height: 18px` / `font-medium uppercase tracking-wider`

---

## 3. Core Component Library Specifications

### 3.1 Sticky Frosted Header (`Header.tsx`)
- **Container:** `sticky top-0 z-50 flex items-center justify-between py-4 px-6 bg-white/50 dark:bg-slate-950/50 backdrop-blur-2xl border-b border-white/20 dark:border-white/10`.
- **Elements:** Brand logo SVG + Title text, navigation links (`/blog`, `/tags`, `/projects`, `/about`), Search trigger button, Theme switcher dropdown, Mobile hamburger drawer.

### 3.2 Showcase Card (`Card.tsx`)
- **Structure:** Frosted card (`rounded-2xl border overflow-hidden`) with top preview image (`h-48 object-cover`), title with hover color transition, brief description, and arrow link (`Learn more →`).

### 3.3 Article Reader Layout (`PostLayout.tsx` & `PortableTextRenderer.tsx`)
- **Structure:**
  - Sticky frosted back button / breadcrumb.
  - Article header with publishing date, reading time estimate, tags, and multi-author cards.
  - Two-column desktop grid: Left/Main = Prose body; Right = Floating Table of Contents + Author profile card.
  - Floating footer with Scroll-to-Top glass button and Comments section (Giscus).

### 3.4 Theme Switcher Menu (`ThemeSwitch.tsx`)
- **Structure:** Headless UI menu with floating frosted panel (`bg-white/65 dark:bg-slate-900/65 backdrop-blur-xl border border-white/30 rounded-xl shadow-lg`).

---

## 4. Google Stitch Prompting Blueprint (Zoom-Out-Zoom-In)

Use this prompt format when generating editorial layouts with **Google Stitch**:

```markdown
### STITCH GENERATION TEMPLATE: `tekgo-ui`

[1. CONTEXT]
Design an editorial developer publication page for "tekgo-ui".
Audience: Senior software engineers, open-source contributors, tech readers.
Vibe: High-end editorial, clean typography, refined "Liquid Glass" frosted accents.

[2. PLATFORM CONSTRAINTS]
Desktop web view (1200px max container) with mobile responsiveness.
Framework: Next.js 15 (App Router) + Tailwind CSS v4.
Strict Rule: Maintain high readability (WCAG AA) in prose while applying frosted glass to surrounding navigation, cards, and toolbars.

[3. LAYOUT & GLASS TOKENS]
- Header: Sticky frosted bar (backdrop-blur-2xl, bg-white/50 light, bg-slate-950/50 dark, hairlineWidth bottom border).
- Accent Color: Vibrant magenta/violet (oklch(0.656 0.241 354.308)).
- Typography: Space Grotesk for bold headlines, clean sans-serif for body prose.
- Cards: Frosted glass containers (backdrop-blur-xl bg-white/65 dark:bg-slate-900/65 border border-white/30 dark:border-white/10).

[4. SCREEN SPECIFICS: <INSERT SCREEN NAME>]
- Hero / Header: Article title, author avatar with name, published date, tags as frosted pill badges.
- Main Body: Clean markdown/prose with styled code blocks (glass header on code snippet with copy button).
- Sidebar: Floating Table of Contents highlighting current scroll position.
- Bottom: Author biography glass card + Related articles grid.
```

---

## 5. Responsive Layout & SEO Constraints

- **Responsive Container:** `SectionContainer.tsx` caps max-width at `max-w-3xl sm:px-6 xl:max-w-5xl xl:px-0`.
- **Reading Comfort:** Line width constrained to `max-w-none prose dark:prose-invert` for optimal 65-75 characters per line readability.
- **Search & Discovery:** OpenGraph image generation, RSS feed (`/feed.xml`), and JSON-LD structured data synchronized via `seo.tsx`.
