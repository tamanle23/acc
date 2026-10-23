# History Entry 328: Replace packages/core/src/logger.ts with UniversalLogger

**Date:** 2026-10-24
**Status:** Completed
**Author:** AI Agent (TypeScript Node Architect)

## Context & Motivation
As part of the monorepo isomorphism unification, `packages/core/src/logger.ts` was redundant with `packages/core-isomorphic/src/logger/UniversalLogger.ts`.
This task eliminates `packages/core/src/logger.ts` entirely and migrates all `packages/core` internal modules to consume `UniversalLogger` directly from `@acc/core-isomorphic`, while re-exporting `UniversalLogger as Logger` and `LogLevel` from `@acc/core/src/index.ts` for clean backward compatibility.

## Key Changes
1. **Eliminated `packages/core/src/logger.ts`**:
   - Deleted `packages/core/src/logger.ts`.
2. **Updated `packages/core/src/index.ts`**:
   - Re-exported `{ UniversalLogger, UniversalLogger as Logger, LogLevel }` from `@acc/core-isomorphic`.
3. **Updated Internal Core Call Sites**:
   - Replaced internal imports (`from './logger'`, `from '../logger'`, `from '../../logger'`, `from '../../../logger'`) across 29 modules in `packages/core` with `import { UniversalLogger as Logger } from '@acc/core-isomorphic';`.
4. **Verification**:
   - Verified that all 32 tests across 9 test suites pass cleanly (`bun test`).
   - Boundary linter passed with 0 native leaks (`bun run scripts/check-native-imports.ts`).
