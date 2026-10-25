# Swagger UI Missing Version Field Fix (After Login)

## Changes Made
- Identified the root cause of Swagger UI's "missing version field" error which occurred exclusively after logging in. 
- Disabled Spring Data introspection in `springdoc-openapi` across all backend services (`acc-ms-aio`, `acc-ms-fs`, `acc-ms-identity`, `acc-ms-worker`, `acc-report-engine`) by setting `springdoc.show-spring-data-pageable: false` and `springdoc.show-spring-data-rest: false` in their respective `application.yml`/`application-local.yml` files.

## Root Cause Analysis
- Before the `permitAlls` fix, Swagger UI was blocked by a `401 Unauthorized`.
- After logging in, the `X-AUTH-TOKEN` bypasses the `401` block, allowing the request to reach `OpenApiWebMvcResource`.
- When Springdoc attempts to lazily generate the OpenAPI definition, it scans the controller methods. When it encounters Spring Data `Page`/`Pageable` types, it attempts to use the `org.springframework.data.util.TypeInformation` class.
- Because this project uses Spring Boot 4 / Spring Data 4 (where `TypeInformation` was removed) and relies on a stub `TypeInformation` to prevent `NoClassDefFoundError` on startup, Springdoc's attempt to invoke methods like `getType()` on the stub results in a `NoSuchMethodError`.
- `NoSuchMethodError` is an `Error` (not an `Exception`) and bypasses the custom `GlobalExceptionHandler`. The Servlet Container catches it and returns a `500 Internal Server Error` HTML page.
- Swagger UI attempts to parse this HTML as JSON, fails, and returns the misleading "The provided definition does not specify a valid version field" error.

## Validation
- YAML syntax was validated and backend compilation succeeded.
- Disabling Spring Data introspection prevents Springdoc from interacting with the `TypeInformation` stub, thereby eliminating the `NoSuchMethodError`.
- **Note**: The user must restart their running backend instance for these configuration changes to take effect.
