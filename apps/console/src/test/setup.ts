// vitest setup file
import '@testing-library/dom';
import 'vitest-axe/extend-expect';
import { expect } from 'vitest';
import * as matchers from 'vitest-axe/matchers';

// Fix undici/jsdom Node.js 20 webidl compatibility in Vitest worker threads
const globalObj = globalThis as unknown as Record<string, Record<string, unknown>>;
if (typeof globalObj.webidl === 'undefined' || !(globalObj.webidl?.util as Record<string, unknown>)?.markAsUncloneable) {
  globalObj.webidl = globalObj.webidl || { util: {} };
  (globalObj.webidl.util as Record<string, unknown>).markAsUncloneable = () => {};
}

expect.extend(matchers);
