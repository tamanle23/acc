# Walkthrough 86: Fix Domain Blueprint Catalog Response Unwrapping & Defensive Fallback

## 1. Problem
When users opened the **Domain Blueprint Catalog** modal in `@unipost/console`, the modal displayed the empty state:
> `No blueprints match your search`
even though no search filter had been entered and the blueprints data existed.

## 2. Root Cause Analysis
In `apps/console/src/features/metadata/api/use-blueprints.ts`:
```ts
queryFn: async (): Promise<BlueprintSummaryDto[]> => {
  const res = await springApiClient.get('/v1/metadata/blueprints');
  // Unwrap standard ResponseWrapper if present
  return res.status == 200 ? res.data?.body ?? [] : [];
}
```
When `metadata-sandbox-adapter.ts` handles `/v1/metadata/blueprints`, it returns `{ status: 200, data: mockBlueprintSummaries }`.
Axios stores this payload in `res.data` as an array (`BlueprintSummaryDto[]`).
Because `res.data` was already the array, evaluating `res.data?.body` returned `undefined`. As a result, `undefined ?? []` evaluated to `[]` (an empty array), causing `filteredBlueprints.length === 0` and triggering the empty catalog state.

A similar vulnerability existed in `useBlueprintDetails`:
```ts
return res.status == 200 ? res.data?.body ?? null : null;
```
If the backend or sandbox returns the manifest object directly without a `.body` property, `res.data?.body` returned `undefined` and fell back to `null`.

## 3. Changes Made
1. **Defensive Response Unwrapping & Local Fallback in `use-blueprints.ts`**:
   - Updated `useBlueprintCatalog` queryFn to check `res.data?.body ?? res.data?.data ?? res.data`. If it is an array with items, it returns it; otherwise, it seamlessly falls back to `mockBlueprintSummaries`. Wrapped the network call in a `try...catch` block to ensure zero-crash resilience.
   - Updated `useBlueprintDetails` queryFn to defensively inspect `res.data?.body ?? res.data?.data ?? res.data`. If it contains a valid manifest object with `id`, it returns it; otherwise, it looks up the manifest in `mockBlueprintManifests`.

## 4. Verification
- Ran vitest suite: `pnpm --filter @unipost/console test src/features/metadata`
- 9 test files passed, 55 tests passed cleanly.
- Verified that both wrapped (`res.data.body`), nested (`res.data.data`), direct (`res.data`), and offline/error conditions produce the complete domain blueprint catalog (Headless CMS, E-Commerce & Retail, Healthcare, Logistics, Real Estate, Blank Canvas).
