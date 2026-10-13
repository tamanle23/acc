// vitest setup file
import '@testing-library/dom';
import * as matchers from 'vitest-axe/matchers';
import { expect } from 'vitest';

expect.extend(matchers);
