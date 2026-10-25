# History Log 058: Console Wired to GDPR Art. 20 Streaming Export

## Problem
The console's data-privacy panel still called the buffered `/export` endpoint and held the whole ZIP as an in-memory blob, defeating the Phase 18 streaming endpoint. A previous change (log 052) also introduced `/api/v1/...` paths on `springApiClient`, whose `baseURL` is already `/api`, producing `/api/api/v1/...`.

## Changes
- `export-download.ts` (new): `downloadTenantExport` calls `/v1/metadata/tenants/{id}/export-stream` via `springApiClient` (auth, tenant and traceparent headers preserved). With the File System Access API it pipes chunks straight to disk (axios `fetch` adapter, `responseType: 'stream'`); otherwise it falls back to a buffered blob download. The writable is aborted on failure.
- `data-privacy-panel.tsx`: uses the helper; dismissing the save dialog shows "Export cancelled"; fixed the purge path to `/v1/metadata/tenants/{id}/purge`.
- `__tests__/export-download.test.ts`: streaming path, error/abort path, blob fallback.

## Verification
- 3/3 new tests pass when run in isolation with a temporary vitest config (since removed).
- `tsc --noEmit` for `@acc/console` passes.

## Known issues (not caused by this change)
- The console's regular vitest setup (`src/test/setup.ts`) currently fails: `vitest-axe` is declared but not linked in `apps/console/node_modules`. `pnpm install --frozen-lockfile` is blocked by an uncommitted `packages/ui/package.json` change from another session (lockfile out of date). Full console test/e2e suites were therefore not re-run.
- Browsers without the File System Access API (Firefox, Safari) still buffer the archive in memory.
- Older `/api/v1/...` doubled-prefix paths may exist elsewhere; only this panel was fixed.
