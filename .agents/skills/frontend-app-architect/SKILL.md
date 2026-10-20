---
name: frontend-app-architect
description: Design, implement, and verify client-side web applications using React, Next.js, TypeScript, state management libraries, and Zod runtime schema validation. Use when the user asks to build or refactor frontend components, custom hooks, API integration layers, form validation, or routing.
---
# Frontend Application Architect

Build robust, type-safe client-side applications in React, Next.js, Vue, or Angular with strict boundary validation, clean separation of concerns, and zero-type-error verification.

## When to Use

- Architecting or refactoring client-side state management, TanStack Query hooks, or data-fetching layers
- Implementing form validation and schema parsing with React Hook Form and Zod
- Structuring Next.js App Router layouts, server/client boundaries, and error/suspense boundaries
- Auditing client bundles, preventing unnecessary re-renders, and fixing TypeScript compilation errors

## Steps

### 1. Inspect Project Stack and Conventions

Examine `package.json` and `tsconfig.json` before writing code:

- Identify the framework (React, Next.js App Router, Vite) and core libraries (Zustand, TanStack Query, Zod, Tailwind).
- Check TypeScript strict mode settings (`"strict": true`).

### 2. Enforce Boundary Type Safety with Zod

Never trust external API responses or form inputs:

- Define runtime Zod schemas for all incoming API payloads and form inputs.
- Derive TypeScript types directly from schemas using `z.infer<typeof Schema>` to keep types and runtime validation permanently in sync.
- Forbid the use of `any`; use `unknown` with type guards or strict discriminated unions.

### 3. Separate Server State from UI State

- **Server State:** Use TanStack Query (or SWR) for fetching, caching, background refetching, and optimistic mutations. Avoid storing server data in local `useState` or Redux/Zustand stores.
- **Client/UI State:** Use Zustand or React Context strictly for ephemeral UI state (modals open, sidebar collapsed, theme selection).
- **Custom Hooks:** Encapsulate complex business logic, data mutation flows, and side-effects in reusable custom hooks (`useEntityData.ts`).

### 4. Component Structure and Error Boundaries

- Keep presentational components pure and decoupled from data-fetching logic.
- Wrap asynchronous page sections in React `<Suspense>` boundaries with skeleton fallbacks and `<ErrorBoundary>` components for failure recovery.

### 5. Compile and Verify

Run TypeScript type-checking and linters immediately after changes:

```bash
# TypeScript Type Check
npx tsc --noEmit

# Linter Check
npm run lint
```

Resolve all type errors and lint warnings until both commands exit with code `0`.
