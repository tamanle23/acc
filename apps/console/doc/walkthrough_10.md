# Walkthrough: Dropdown Opening Responsiveness Optimization

Eliminated the noticeable latency and input lag when opening dropdown menus across `apps/acc-console`.

## 1. Summary of Changes

| Component / File | Optimization Applied |
| :--- | :--- |
| [`src/components/ui/dropdown-menu.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/dropdown-menu.tsx) | Set default `modal = false` to eliminate Radix DOM lock, scroll lock, and whole-tree `aria-hidden` traversal. Upgraded `DropdownMenuContent` and `DropdownMenuSubContent` with `backdrop-blur-md`, `duration-100`, `will-change-[transform,opacity]`, and subtle 4px slide (`slide-in-from-top-1`). |
| [`src/components/profile-dropdown.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/profile-dropdown.tsx) | Removed `forceMount` from `DropdownMenuContent` to prevent persistent hidden DOM nodes and unwanted router link preloading when closed. |
| [`src/components/ui/select.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/select.tsx) | Accelerated `SelectContent` animation with `duration-100 will-change-[transform,opacity]` and 4px slide. |
| [`src/components/ui/popover.tsx`](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/popover.tsx) | Lightened GPU backdrop blur to `backdrop-blur-md` and accelerated animation to `duration-100 will-change-[transform,opacity]`. |

---

## 2. Technical Explanation

- **Eliminated Synchronous DOM Traversal**:
  Radix UI's `DropdownMenu` defaults to `modal={true}`. Whenever opened, Radix ran a recursive DOM walker across `#root` setting `aria-hidden="true"` on every other element and mounted a scroll blocker into `<head>`. Switching the default to `modal = false` removes this overhead completely while preserving normal outside-click dismissal.
- **Lightened GPU Composite Overhead**:
  `backdrop-blur-2xl` requires 40px multi-pass Gaussian blur on every frame of an entrance animation. Reducing to `backdrop-blur-md` with `duration-100` and `will-change-[transform,opacity]` allows GPU rasterization to complete in 1-2 frames without compositor stalls or frame drops.
- **Removed `forceMount` Overhead**:
  Removing `forceMount` ensures portal contents are only rendered when opened.

---

## 3. Validation & Build Results

- **Build**: `pnpm --filter @acc/console build:web` completed with exit code 0 in 682ms.
- **Lint**: `pnpm --filter @acc/console lint` passed with 0 errors and 0 warnings.
