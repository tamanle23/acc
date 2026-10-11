# History Log 055: Model Context Protocol (MCP) Dynamic Tool Synthesis & ResolvableType Dynamic Dispatch (Phase 17)

## Problem
In Iteration 1, autonomous LLM agents had no standardized way to introspect dynamic tenant schemas, discover available actions, or execute CQRS commands without manual OpenAPI plumbing. Furthermore, generic CQRS command execution in backend mediators must strictly avoid raw reflection to prevent CGLIB proxy dispatch breakages over Spring `@Transactional` or `@PreAuthorize` aspects.

## Plan
1. **Dynamic Model Context Protocol (MCP) Server Architecture (`packages/client`)**:
   - Define MCP protocol types (`McpToolDefinition`, `McpManifest`, `McpJsonRpcRequest`, `McpJsonRpcResponse`, `McpToolCallParams`, `McpToolCallResult`) conforming to JSON-RPC 2.0.
   - Implement `synthesizeMcpManifest()` synthesizing dynamic tool manifests directly from active tenant `UNIPOST_ENTITY_TYPES`:
     - `unipost_get_schema`: Returns JSON Schema Draft-07 for specified entity type.
     - `unipost_query_entities`: RLS-scoped search with pagination and filtering.
     - `unipost_execute_transition`: Executes FSM lifecycle state machine transitions with parameter validation.
     - `unipost_create_entity`: Validates attributes against server schema and creates records.
   - Implement `compileDraft07Schema()` mapping schema definitions into Draft-07 JSON Schema documents.
   - Implement `McpServer` class handling `tools/list` and `tools/call` JSON-RPC 2.0 requests over the universal `UnipostClient`.
2. **Spring Modulith `ResolvableType` Dynamic Command Dispatch (`apps/backend/unipost-core`)**:
   - Implement `DynamicCommandDispatcher` utilizing Spring Framework's `org.springframework.core.ResolvableType` to resolve target generic command parameters safely across CGLIB proxies.
   - Safely deserialize heterogeneous JSONB attribute maps into strongly typed command records via `ObjectMapper`.
   - Add unit test suite in `DynamicCommandDispatcherTest`.
3. **Comprehensive Verification**:
   - Add test suite in `packages/client/src/__tests__/mcp-server.test.ts` verifying all 4 MCP tools, JSON-RPC protocol error states, and RLS tenant header propagation.
   - Execute Maven unit tests in `unipost-core`.
   - Execute Turborepo strict type checks and unit test runs across the monorepo (`pnpm turbo run check-types`, `pnpm turbo run test`).
   - Run Playwright E2E suite (`pnpm --filter @unipost/console test:e2e`).

## Changes
- **`apps/backend/unipost-core/src/main/java/com/unipost/core/mediator/DynamicCommandDispatcher.java`**: Implemented type-safe `DynamicCommandDispatcher` with `ResolvableType` validation and dynamic payload deserialization.
- **`apps/backend/unipost-core/src/test/java/com/unipost/core/mediator/DynamicCommandDispatcherTest.java`**: Added tests for direct command dispatch, dynamic JSONB payload dispatch, and argument validation.
- **`apps/backend/unipost-core/pom.xml`**: Added `spring-boot-starter-test` dependency for test execution.
- **`packages/client/src/mcp/types.ts`**: Defined MCP JSON-RPC 2.0 types and tool definition contracts.
- **`packages/client/src/mcp/synthesizer.ts`**: Implemented `synthesizeMcpManifest()` and `compileDraft07Schema()`.
- **`packages/client/src/mcp/server.ts`**: Implemented `McpServer` orchestrating dynamic tool execution over `UnipostClient`.
- **`packages/client/src/mcp/index.ts`**: Re-exported all MCP types and classes.
- **`packages/client/src/index.ts`**: Exported MCP module from `@unipost/client`.
- **`packages/client/src/__tests__/mcp-server.test.ts`**: Added comprehensive test coverage for MCP server and JSON-RPC dispatch.

## Verification
- `apps/backend/unipost-core` Maven test: **3/3 passed** (0 failures, 0 errors).
- `packages/client` Vitest: **3 test files, 18/18 passed** (100% green).
- `pnpm turbo run check-types`: **4/4 passed** (0 errors).
- `pnpm turbo run test`: **6/6 passed** (All backend Spring Modulith, Console, Client, Sandbox, Tokens, Mobile suites green).
- `pnpm --filter @unipost/console test:e2e`: **3/3 passed** (Chromium headless with Axe WCAG 2.2 AA audit).
