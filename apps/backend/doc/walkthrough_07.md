# UserGraphqlController — Fix & Debug Walkthrough

**Date:** 2026-09-22
**Scope:** `acc-ms-aio`, `acc-ms-identity`, root `pom.xml`

---

## Summary

After the initial `UserGraphqlController` implementation (see `walkthrough_06.md`), three
successive runtime errors were encountered and resolved. This document captures the
root cause, fix, and lesson learned for each.

---

## Fix 1 — `No endpoint GET /graphiql` (duplicate YAML key)

### Symptom
Accessing `http://localhost:8000/graphiql` returned `No endpoint GET /graphiql`.

### Root Cause
The `spring.graphql` configuration block was written as a **second `spring:` root key**
in `acc-ms-identity/src/main/resources/application.yml`:

```yaml
# Line 36 – existing block
spring:
  application:
    name: acc-ms-account
  ...

# Line 118 – NEW block (silently ignored by YAML parsers)
spring:
  graphql:
    path: /graphql
    graphiql:
      enabled: true
```

YAML does not allow duplicate root keys. Parsers silently discard the second
occurrence, so `spring.graphql` was never read and the GraphQL servlet was never
registered.

Additionally, the AIO service (`acc-ms-aio`) has its own `application.yml`
with `spring.graphql` already configured — the identity module config is only
relevant when running the identity service standalone.

### Fix
**`acc-ms-aio/src/main/resources/application.yml`** — `spring.graphql` was
already present; only `/graphql` and `/graphiql` were missing from
`application.security.permitAlls` in **`application-local.yml`**:

```yaml
# acc-ms-aio/src/main/resources/application-local.yml
application:
  security:
    permitAlls:
      ...
      - /graphql        # ← added
      - /graphiql       # ← added
      - /graphiql/**    # ← added
```

**`acc-ms-identity/src/main/resources/application.yml`** — merged
`spring.graphql` as a nested key inside the existing `spring:` block instead of
a separate root key.

### Lesson
Always merge new Spring properties under the **existing** `spring:` key in a
YAML file. YAML does not merge duplicate root keys — the second one is silently
dropped.

---

## Fix 2 — `No endpoint GET /graphiql` (wrong schema `locations` format)

### Symptom
After the YAML key fix, `/graphiql` was still unreachable.

### Root Cause
The AIO `application.yml` had:

```yaml
spring:
  graphql:
    schema:
      locations: classpath*:graphql/**/*.graphqls   # WRONG
```

`spring.graphql.schema.locations` expects **directory prefix paths**, not file
globs. Spring for GraphQL resolves each location as a directory and then appends
the `file-extensions` pattern internally. Supplying a full file glob embedded in
the location path resolves to zero resources — schema building silently fails and
no GraphQL servlet (including GraphiQL) is registered.

### Fix
**`acc-ms-aio/src/main/resources/application.yml`**:

```yaml
spring:
  graphql:
    schema:
      # classpath*: scans ALL classpath roots (app + every dependency JAR)
      locations: classpath*:graphql/
      file-extensions: .graphqls
```

`classpath*:` (with wildcard) scans all classpath roots including every
dependency JAR on the classpath (`acc-fw.jar` → `base.graphqls`,
`acc-ms-identity.jar` → `users.graphqls`). `classpath:` (without wildcard)
only finds the first matching root and is therefore redundant.

### Lesson
`spring.graphql.schema.locations` → **directory path** (e.g. `classpath*:graphql/`)
`spring.graphql.schema.file-extensions` → **file extension filter** (e.g. `.graphqls`)

---

## Fix 3 — `IllegalArgumentException: Name for argument of type [String] not specified`

### Symptom
```
Error creating bean with name 'graphQlSource'
Caused by: java.lang.IllegalArgumentException:
  Name for argument of type [java.lang.String] not specified, and
  parameter name information not found in class file either.
```

### Root Cause
Spring for GraphQL resolves `@Argument`-annotated parameters by name. It reads
the name from either:

1. The annotation value — `@Argument("uid")` ← explicit
2. The bytecode parameter name table — only present when compiled with `-parameters`

The root `pom.xml` did not include `-parameters` in `maven-compiler-plugin`, so
Java stripped parameter names from `.class` files. The bare `@Argument` (no value)
annotations in `UserGraphqlController` could not be resolved.

### Fix
Two-layer fix applied:

**Immediate — explicit names on every `@Argument` in `UserGraphqlController.java`:**

```java
// Before
public UserVm user(@Argument String uid)
public Page<UserVm> users(@Argument UserSearchInput request)
public Page<PermissionVm> userPermissions(@Argument String uid, @Argument PageInput request)
public Page<RoleVm> userRoles(@Argument String uid, @Argument PageInput request)
public UserProfileVm userProfile(@Argument String uid)
public UserVm userWithPermissions(@Argument String uid)

// After
public UserVm user(@Argument("uid") String uid)
public Page<UserVm> users(@Argument("request") UserSearchInput request)
public Page<PermissionVm> userPermissions(@Argument("uid") String uid, @Argument("request") PageInput request)
public Page<RoleVm> userRoles(@Argument("uid") String uid, @Argument("request") PageInput request)
public UserProfileVm userProfile(@Argument("uid") String uid)
public UserVm userWithPermissions(@Argument("uid") String uid)
```

**Permanent — add `-parameters` to root `pom.xml`:**

```xml
<!-- pom.xml → build → plugins → maven-compiler-plugin → configuration -->
<compilerArgs>
  <compilerArg>-Amapstruct.defaultComponentModel=spring</compilerArg>
  <compilerArg>-parameters</compilerArg>   <!-- ← added -->
</compilerArgs>
```

### Lesson
Always add `-parameters` to the Maven compiler in any project using Spring for
GraphQL, Spring MVC with implicit parameter binding, or Spring Data. Without it,
reflective parameter name resolution fails at runtime. The explicit
`@Argument("name")` form is also a good defensive practice regardless.

---

## Files Changed

| File | Change |
|---|---|
| `acc-ms-aio/src/main/resources/application.yml` | Fixed `schema.locations` to directory path format; added `file-extensions` |
| `acc-ms-aio/src/main/resources/application-local.yml` | Added `/graphql`, `/graphiql`, `/graphiql/**` to `permitAlls` |
| `acc-ms-identity/src/main/resources/application.yml` | Merged `spring.graphql` inside existing `spring:` block |
| `acc-ms-identity/.../UserGraphqlController.java` | Added explicit names to all `@Argument` annotations |
| `pom.xml` (root) | Added `-parameters` to `maven-compiler-plugin` `compilerArgs` |

## Commit References

| Hash | Message |
|---|---|
| `cdd8759` | `fix(identity): move spring.graphql inside existing spring: block` |
| `9b9325a` | `fix(aio): add /graphql and /graphiql to AIO local permitAlls` |
| `a3a1006` | `fix(aio): fix spring.graphql.schema.locations format` |
| `b83d8a0` | `refactor(aio): simplify graphql schema location to single classpath*:graphql/` |
| `59fae6b` | `fix(identity): resolve @Argument parameter name resolution failure` |
