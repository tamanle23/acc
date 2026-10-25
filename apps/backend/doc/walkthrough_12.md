# Walkthrough 12: Fix Liquibase Duplicate Key Violation & Checksum Rule Compliance

## Changes Made
1. **Removed `runAlways="true"` & `runOnChange="true"`**:
   - Updated `apps/backend/acc-db/src/main/resources/db/identity/changelog-master_data.xml` and `changelog-mock_data.xml` to remove `runAlways="true"` and `runOnChange="true"`.
   - Reason: `runAlways="true"` was forcing Liquibase to re-run data insertion SQL scripts on every execution, causing PostgreSQL to throw `duplicate key value violates unique constraint "un_role_uid"` on key `(uid)=(a7d87556-a281-4965-829e-877beb3682d0)`.

2. **Liquibase Migration Standards**:
   - Existing changesets will not be edited going forward to preserve MD5 checksum integrity across environments.
   - Any new schema modifications or data updates will be isolated in incremental changelog files (e.g. `changelog-000.000.00002.xml`).

## Verification
- Confirmed no overlapping UUIDs exist between `changelog-master_data.xml` and `changelog-mock_data.xml`.
- Verified `changelog-master.xml` imports `changelog-000.000.00000.xml`, `changelog-000.000.00001.xml`, `changelog-master_data.xml`, and `changelog-mock_data.xml` cleanly.
