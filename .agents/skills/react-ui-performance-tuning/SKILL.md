---
name: react-ui-performance-tuning
description: "Profile, diagnose, and optimize React application performance. Use when resolving excessive re-renders, optimizing main thread execution, memoizing components, virtualizing lists, reducing bundle sizes, or improving Core Web Vitals."
---
# React UI Performance Expert

A specialized skill for auditing, profiling, and tuning React applications to achieve 60 FPS rendering, eliminate UI jank, and minimize main-thread blocking.

## When to Use This Skill

- Diagnosing and fixing excessive, cascading, or unnecessary re-renders.
- Implementing advanced memoization strategies (`useMemo`, `useCallback`, `React.memo`).
- Optimizing large list rendering through virtualization or windowing.
- Utilizing React 18+ concurrent features (`useTransition`, `useDeferredValue`).
- Resolving main-thread blocking from heavy synchronous JavaScript functions.
- Analyzing bundle sizes, implementing code-splitting, and lazy loading.
- Resolving memory leaks, stale closures, and UI thread blocking.

---

## 1. Profiling & Diagnostics

- **Measure First, Optimize Second:** Never guess what is slow. Rely on the React DevTools Profiler (with "Record why each component rendered" enabled) and the Chrome DevTools Performance tab.
- **Identify Bottlenecks:** Distinguish between slow *render phases* (heavy JavaScript execution in the component body) and slow *commit phases* (heavy DOM mutations, layout thrashing, or forced synchronous layouts).

---

## 2. Re-render Optimization & State Architecture

- **State Colocation:** Move state as close to where it is used as possible (down the tree) to prevent top-down waterfall renders across unrelated components.
- **Component Composition (The `children` Pattern):** Wrap stateful logic in a parent and pass expensive components as `children`. When the parent's state changes, React knows the `children` reference hasn't changed and skips re-rendering them.
- **Judicious Memoization:** 
  - Use `React.memo` only for components that render frequently with the exact same props. 
  - Use `useMemo` for mathematically expensive calculations, not just basic object creation. 
  - Use `useCallback` primarily when passing functions to deeply nested memoized child components or when the function is a dependency in a `useEffect`.
- **Reference Equality:** Beware of inline objects `{{ padding: 10 }}`, arrays `[1, 2]`, and inline arrow functions passed as props to memoized components. They create new references on every render, instantly breaking `React.memo`.

---

## 3. Main Thread Blocking & Synchronous Execution

- **Web Workers:** For heavy computational tasks (parsing large JSON, complex math, data transformation), offload the work to background threads using Web Workers. This leaves the main thread 100% free for the UI and prevents freezing.
- **Time-Slicing (Chunking):** If Web Workers cannot be used, break massive synchronous loops into smaller chunks. Yield control back to the event loop (via `setTimeout` or `requestAnimationFrame`) to allow the browser to paint and handle user interactions between chunks.
- **React 18 Limitations:** Remember that `useTransition` and `useDeferredValue` only chunk React's own rendering work (Virtual DOM diffing). They **cannot** interrupt heavy synchronous JavaScript execution (like a massive `Array.map` or `JSON.parse`). 

---

## 4. Rendering Large Datasets

- **List Virtualization:** Never render thousands of DOM nodes simultaneously. Use `@tanstack/react-virtual` or `react-window` to render only the visible items plus a small overscan buffer.
- **Pagination & Infinite Fetching:** For massive datasets, combine virtualization with cursor-based infinite fetching so memory consumption remains flat regardless of how far the user scrolls.

---

## 5. Concurrent React (React 18+)

- **`useTransition`:** Keep the UI highly responsive by wrapping heavy, non-urgent state updates (like filtering a massive list) in `startTransition`. This allows React to interrupt the heavy render if the user types or clicks elsewhere.
- **`useDeferredValue`:** Defer the rendering of expensive downstream components based on rapidly changing state (like search inputs) without needing manual debounce hooks.

---

## 6. Bundle & Asset Optimization

- **Code Splitting:** Implement route-level code splitting using `React.lazy` and `<Suspense>` to reduce initial load time, Total Blocking Time (TBT), and Time to Interactive (TTI).
- **Dynamic Imports:** Defer loading heavy third-party libraries (e.g., charts, rich text editors, PDF generators) until they are actually needed in the viewport or via user interaction.

---

## 7. Memory Management & Effect Safety

- **Effect Cleanup:** Always return cleanup functions in `useEffect` when setting up event listeners, intervals, WebSockets, or `IntersectionObservers` to prevent memory leaks when components unmount.
- **Stale Closures:** Utilize `useRef` to hold mutable values (like the latest state) that need to be accessed inside asynchronous callbacks or intervals without triggering re-renders or falling into stale closure traps.
