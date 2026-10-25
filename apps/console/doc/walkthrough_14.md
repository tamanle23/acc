# Walkthrough: Disable Theme Settings by Default & Set Inset Default Layout

Disabled the **Theme Settings** sidebar/drawer (`ConfigDrawer`) by default so that it only displays when an explicit flag is provided. Standardized the sidebar to **Inset** and layout to **Default** (expanded).

## Changes Made

### Console Application (`apps/console`)

#### 1. Flag-Controlled Theme Settings Drawer ([`config-drawer.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/config-drawer.tsx))
- Added flag detection inside `ConfigDrawer`:
  ```tsx
  const isEnabled =
    forceShow ||
    import.meta.env.VITE_ENABLE_THEME_SETTINGS === 'true' ||
    import.meta.env.VITE_SHOW_THEME_SETTINGS === 'true' ||
    (typeof window !== 'undefined' &&
      (new URLSearchParams(window.location.search).get('themeSettings') === 'true' ||
        localStorage.getItem('theme_settings_enabled') === 'true'))
  ```
- If no flag is present, `ConfigDrawer` returns `null`, hiding the Settings cog icon button in headers across all pages.
- Can be activated via:
  1. CLI/Env: `VITE_ENABLE_THEME_SETTINGS=true`
  2. npm script: `pnpm --filter @acc/console dev:theme-settings`
  3. URL query param: `?themeSettings=true`
  4. LocalStorage: `localStorage.setItem('theme_settings_enabled', 'true')`
  5. Component prop: `<ConfigDrawer forceShow />`

#### 2. Vite Build & Dev Configurations ([`vite.config.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/vite.config.ts) & [`vite.electron.config.ts`](file:///c:/Users/Admin/workspace/git/acc/apps/console/vite.electron.config.ts))
- Injected define for `import.meta.env.VITE_ENABLE_THEME_SETTINGS` detecting:
  - `--theme-settings` / `--enable-theme-settings` CLI flags
  - `VITE_ENABLE_THEME_SETTINGS=true` environment variable
  - `mode === 'theme-settings'`

#### 3. Package Script ([`package.json`](file:///c:/Users/Admin/workspace/git/acc/apps/console/package.json))
- Added convenience script:
  ```json
  "dev:theme-settings": "vite --theme-settings"
  ```

#### 4. Sidebar & Layout Defaults ([`layout-provider.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/context/layout-provider.tsx) & [`authenticated-layout.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/console/src/components/layout/authenticated-layout.tsx))
- Verified that `DEFAULT_VARIANT` is `'inset'`.
- Verified that `defaultOpen` defaults to `true` (layout option `"default"`, expanded sidebar).

## Verification Results

### 1. TypeScript & Full Build (Web + Electron)
Command:
```bash
pnpm --filter @acc/console build
```
Result: **Passed** (exit code 0, 0 type errors).

### 2. ESLint Code Quality
Command:
```bash
pnpm --filter @acc/console lint
```
Result: **Passed** (exit code 0, 0 warnings, 0 errors).
