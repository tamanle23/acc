// vitest setup file
import '@testing-library/dom';
import 'vitest-axe/extend-expect';
import { expect } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

// Fix undici/jsdom Node.js 20 webidl compatibility in Vitest worker threads
if (typeof (globalThis as any).webidl === 'undefined' || !(globalThis as any).webidl?.util?.markAsUncloneable) {
  (globalThis as any).webidl = (globalThis as any).webidl || { util: {} };
  (globalThis as any).webidl.util = (globalThis as any).webidl.util || {};
  (globalThis as any).webidl.util.markAsUncloneable = () => {};
}

expect.extend(matchers);
