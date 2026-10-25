# Dropdown Responsiveness & Instant Open Optimization

Eliminate noticeable opening latency when clicking dropdown triggers (`DropdownMenu`, `Select`, `ProfileSwitcher`, `ProfileDropdown`, `ThemeSwitch`, and table actions) in `apps/acc-console`.

## 1. Problem & Root Causes

1. **Radix UI `modal={true}` Default Traversal**:
   - `DropdownMenuPrimitive.Root` defaults to `modal={true}` unless explicitly set.
   - When opened in modal mode, Radix UI:
     - Freezes body scroll and injects DOM locks (`data-scroll-locked`).
     - Performs a recursive synchronous tree traversal over `#root` setting `aria-hidden="true"` on every other sibling DOM node in the app.
     - In a rich application with cards, tables, and sidebars, this blocks the main thread on every click.
2. **Heavy GPU Backdrop Filter Recomputation (`backdrop-blur-2xl`)**:
   - `DropdownMenuContent`, `DropdownMenuSubContent`, and `PopoverContent` use `backdrop-blur-2xl` (40px blur radius).
   - When a portal opens with CSS animations (`zoom-in-95` + `slide-in-from-top-2`), the browser GPU compositor has to re-sample the multi-stop ambient mesh background and recalculate 40px Gaussian convolutions on every single animation frame, causing frame drops and input stall.
3. **Uncapped Animation Duration**:
   - The Radix animations use `animate-in fade-in-0 zoom-in-95` without an explicit fast duration (defaulting to 150-200ms+ in standard tailwind-animate), causing a perceivable delay between click and presentation.
4. **`forceMount` in `ProfileDropdown`**:
   - `<DropdownMenuContent forceMount>` keeps the menu portal mounted continuously, causing layout checks and TanStack Router link preloads whenever state changes.

---

## 2. Proposed Changes

### `apps/acc-console`

#### [MODIFY] [dropdown-menu.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/dropdown-menu.tsx)
- Set default `modal = false` in `DropdownMenu`:
  ```tsx
  function DropdownMenu({
    modal = false,
    ...props
  }: React.ComponentProps<typeof DropdownMenuPrimitive.Root>) {
    return <DropdownMenuPrimitive.Root data-slot='dropdown-menu' modal={modal} {...props} />
  }
  ```
- Replace `backdrop-blur-2xl` with lighter, responsive `backdrop-blur-md` (or `backdrop-blur-[var(--glass-blur,16px)]`).
- Add `duration-100` and `will-change-[transform,opacity]` to `DropdownMenuContent` and `DropdownMenuSubContent`.
- Subtly reduce slide distance (`data-[side=bottom]:slide-in-from-top-1` / 4px) to ensure silky 60/120fps entry without GPU convolution thrashing.

#### [MODIFY] [profile-dropdown.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/profile-dropdown.tsx)
- Remove `forceMount` on `<DropdownMenuContent>` so it only mounts and activates router links when opened.

#### [MODIFY] [select.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/select.tsx)
- Add `duration-100 will-change-[transform,opacity]` to `SelectContent` for instant response on click.

#### [MODIFY] [popover.tsx](file:///c:/Users/Admin/workspace/git/acc/apps/acc-console/src/components/ui/popover.tsx)
- Optimize `PopoverContent` with `backdrop-blur-md duration-100 will-change-[transform,opacity]`.

---

## 3. Verification Plan

### Automated Tests & Typecheck
- Run `pnpm --filter @acc/console build:web` to ensure no compile errors.
- Run `pnpm --filter @acc/console lint` to verify code quality.

### Manual Verification
- Click on `ProfileDropdown` (avatar in top navbar) $\rightarrow$ opens instantly.
- Click on `ThemeSwitch` (sun/moon button) $\rightarrow$ opens instantly.
- Click on `ProfileSwitcher` (sidebar bottom button) $\rightarrow$ opens instantly with zero DOM lock delay.
- Click on view options / table action dropdowns $\rightarrow$ snappy, instantaneous response.

### Concluding Steps
- Create `apps/acc-console/doc/walkthrough_10.md` and conversation `walkthrough.md`.
- Commit changes cleanly via Git per `.agents/rules/commit-on-execution.md`.
