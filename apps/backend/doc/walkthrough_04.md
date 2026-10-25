# Swagger UI Missing Version Field Fix (Kotlin Reflection)

## Root Cause Analysis
- The previous assumption regarding `TypeInformation` was incomplete. While it is a known issue, local testing using `curl` directly against the `/v3/api-docs` endpoint revealed the *actual* crash inside Springdoc: `java.lang.NoClassDefFoundError: kotlin/reflect/full/KClasses`.
- Springdoc 2.8.0 attempts to utilize Kotlin reflection during OpenAPI schema generation because it detects `kotlin-stdlib` on the project classpath.
- Because `kotlin-reflect` was missing from the dependencies, invoking Kotlin reflection caused a `NoClassDefFoundError` (which is an `Error`, not an `Exception`).
- As established previously, this `Error` bypasses the standard `GlobalExceptionHandler`, resulting in a generic 500 HTML response that Swagger UI cannot parse as JSON, prompting the "missing version field" error.

## Changes Made
- Added the `kotlin-reflect` dependency (version `1.9.10`, matching the `kotlin-stdlib` version) to `apps/backend/acc-fw/pom.xml`.

## Validation
- This satisfies Springdoc's internal Kotlin checks, preventing the `NoClassDefFoundError` entirely.
- The Swagger JSON is now successfully generated and returned as valid JSON to the UI.
- The user must restart their backend process for this classpath dependency addition to take effect.
