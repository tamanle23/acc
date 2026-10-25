# Add Cloud Storage Integration Screen

This plan details the implementation of a new Screen in `@acc/console` to manage different Cloud Storage services (Google Drive, GCS, Cloudflare R2, Storj, Amazon S3).

## Proposed Changes

### apps/console (Features)

#### [NEW] apps/console/src/features/storage/data/storages.tsx
Create a mock data file defining the cloud storage providers (Google Drive, Google Cloud Storage, Cloudflare R2, Storj, Amazon S3). We will include a `storageMode` property ('Archive' or 'CDN') for each as requested.

#### [NEW] apps/console/src/features/storage/index.tsx
Create the main Storage integration screen, mirroring the Liquid Glass UI from the existing "Apps integration" screen. We will add a filter/badge for the `storageMode` (Archive vs CDN).

#### [NEW] apps/console/src/routes/_authenticated/storage/index.tsx
Register the route using TanStack router.

### apps/console (Layout)

#### [MODIFY] apps/console/src/components/layout/data/sidebar-data.ts
Add "Storage" to the General navigation group.

## Verification Plan
1. Ensure the app builds successfully.
2. Manually verify the UI renders the new Storage route with the Liquid Glass UI standards and the mock data.
