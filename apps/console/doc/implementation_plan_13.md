# Module Coupling Refactoring (Priority 2)

We are addressing the tight coupling and duplicated logic across the frontends (`apps/console` and `apps/tekgo-ui`). Currently, both apps independently maintain similar utility functions and duplicate SVG icon assets.

## Proposed Changes

We will create a new shared workspace package in `packages/ui` to house common elements, establishing a strong boundary between application logic and reusable UI components.

### 1. `packages/ui`

We will initialize a new `packages/ui` package with its own `package.json` (`@acc/ui`).

#### [NEW] `packages/ui/package.json`
- Set up as a Turborepo internal package.
- Add dependencies like `lucide-react`, `clsx`, `tailwind-merge`.

#### [NEW] `packages/ui/src/utils.ts`
- Extract the Tailwind `cn()` (clsx + tailwind-merge) utility from `console`.
- Export common formatting helpers (e.g., pagination utilities).

#### [NEW] `packages/ui/src/icons/*`
- Merge the duplicate SVG icons from `apps/console/src/assets/brand-icons` and `apps/tekgo-ui/components/social-icons`.
- Expose a unified `<IconFacebook />`, `<IconGithub />`, `<IconTwitter />`, etc. component suite.

### 2. `apps/console`

#### [MODIFY] `apps/console/package.json`
- Add `"@acc/ui": "workspace:*"` to dependencies.

#### [MODIFY] `apps/console/src/lib/utils.ts`
- Refactor to re-export or completely replace with imports from `@acc/ui/utils`.

#### [DELETE] `apps/console/src/assets/brand-icons/index.ts`
- Delete local brand icons. Components will now import them from `@acc/ui/icons`.

### 3. `apps/tekgo-ui`

#### [MODIFY] `apps/tekgo-ui/package.json`
- Add `"@acc/ui": "workspace:*"` to dependencies.

#### [DELETE] `apps/tekgo-ui/components/social-icons/*`
- Delete local SVG icons.

#### [MODIFY] `apps/tekgo-ui/components/Footer.tsx` (and others)
- Refactor to import icons from `@acc/ui/icons`.

## Verification Plan

### Automated Tests
- Run `pnpm install` at the root to link the new workspace package.
- Run `turbo run build --filter=console --filter=tekgo-ui` to verify that both applications compile successfully with the new `@acc/ui` dependency.

### Manual Verification
- Ensure the dev server starts for both apps and the icons render correctly without missing export errors.
