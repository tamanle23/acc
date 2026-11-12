# UserGraphqlController — Implementation Plan

Mirror every public query operation from `UserQueryController` into `UserGraphqlController` using **Spring for GraphQL** (`@QueryMapping` / `@SchemaMapping`).

## Background

The `acc-ms-identity` module already has:
- `spring-boot-starter-graphql` inherited from `acc-fw` (line 142 of `acc-fw/pom.xml`)
- A placeholder `graphql/users.graphqls` schema (empty)
- A stub `UserGraphqlController` (no handler methods)
- `base.graphqls` in `acc-fw` defining root `Query` and `Mutation` types with `_empty` anchors

## Proposed Changes

### 1. `users.graphqls` — Full GraphQL schema
Define `extend type Query` with 6 operations, 2 input types, 2 enums (matching exact Java enum values), and all output/page types.

### 2. `UserGraphqlController.java` — Handler implementation
Extend `CommonController` (for `extractRequest`), inject `UserService` + `UserMapper`, and implement 6 `@QueryMapping` methods — one per REST endpoint — all guarded by `@PreAuthorize(hasPermission(ResourceConstants.USER, PermissionConstants.LIST))`.

### 3. `application.yml` — GraphQL endpoint config
Add `spring.graphql` block enabling the `/graphql` endpoint and GraphiQL UI at `/graphiql`.

## Query ↔ REST Mapping

| GraphQL Query | REST equivalent |
|---|---|
| `user(uid)` | `GET /api/user/{uid}/_uid` |
| `users(request)` | `POST /api/user/_list` |
| `userPermissions(uid, request)` | `GET /api/user/{uid}/permissions` |
| `userRoles(uid, request)` | `GET /api/user/{uid}/roles` |
| `userProfile(uid)` | `GET /api/user/{uid}/profile` |
| `userWithPermissions(uid)` | `GET /api/user/{uid}/_with_permissions` |
