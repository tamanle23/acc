# Walkthrough 09: Wrap App Items in Liquid Glass Card on Apps Screen

We wrapped the application items on the Apps Integration screen in the standard `Card` component, elevating them into the responsive Liquid Glass design system.

---

## 1. Changes Made

### 1. Wrapped App Items in `Card` Component
- Modified [`apps/index.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/features/apps/index.tsx).
- Replaced plain `<li>` border boxes with `<Card className='flex w-full flex-col justify-between gap-4 p-5'>`.
- Enhanced child element styling:
  - Frosted liquid-glass logo badge: `bg-white/40 dark:bg-white/10 border border-white/30 dark:border-white/10 backdrop-blur-md`.
  - Connect / Connected action buttons with `.liquid-glass-interactive` styling.
  - Automatic reactivity to `--glass-blur`, `--glass-intensity`, and `--glass-specular-alpha`.

### 2. Workspace Package Name Verification
- Verified that package names across `apps/acc-console` and `apps/desktop-console` are now standardized to `@acc/console`.
- Verified `pnpm --filter @acc/console build:web` and `lint` execute cleanly with the updated name.

---

## 2. Verification Results

1. **Build Verification**:
   - `pnpm --filter @acc/console build:web` completed with exit code 0.
2. **Lint Verification**:
   - `pnpm --filter @acc/console lint` passed with 0 errors and 0 warnings.
3. **Appearance Reactivity**:
   - All app cards on `/apps` now display optical frosted glass blur, specular highlights, and fluid hover elevation, dynamically responding to the Liquid Glass intensity slider.
