// vitest setup file
import '@testing-library/dom';
import { expect } from 'vitest';

// Polyfill ResizeObserver for jsdom / React Flow
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

try {
  // @ts-ignore
  const matchers = await import('vitest-axe/matchers');
  expect.extend(matchers);
} catch {
  // vitest-axe optional in environments where it is not installed
}

