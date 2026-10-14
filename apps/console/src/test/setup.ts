// vitest setup file
import '@testing-library/dom';
import { expect } from 'vitest';

try {
  // @ts-ignore
  const matchers = await import('vitest-axe/matchers');
  expect.extend(matchers);
} catch {
  // vitest-axe optional in environments where it is not installed
}
