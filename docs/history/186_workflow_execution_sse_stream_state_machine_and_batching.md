# 186 SSE stream state machine, micro-batching, task log ring buffer

## Problem
Console SSE hook lacked reconnect state, batching and structured logs.

## Plan / Changes
use-workflow-execution-stream.ts: connection state machine, exponential backoff (5 retries), RAF micro-batching, 1000-item log ring buffer + sessionStorage spool; toolbar health pill; tests.

## Verification
vitest src/features/workflows: 84/84 pass; tsc --noEmit clean.

## Walkthrough / Tasks / Enhancement
Next: Workstream 3 (canvas edge flow, auto-pan).
