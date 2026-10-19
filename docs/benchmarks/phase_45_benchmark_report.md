# Phase 45: Enterprise Resilience & Performance Benchmark Report

**Generated At**: 2026-10-19T16:09:12.173019500Z
**Environment**: Spring Modulith / Java 21 / PostgreSQL Lateral AST Compiler
**Test Suite**: `CompositeQueryPerformanceBenchmarkTest`

---

## 1. Concurrency & Throughput Metrics

| Metric | Result | Target Baseline | Status |
| :--- | :---: | :---: | :---: |
| **Total Concurrent Queries** | `1000` | `1,000` | ✅ PASS |
| **Active Worker Threads** | `32` | `32` | ✅ PASS |
| **Total Duration** | `0.04 sec` | `< 10 sec` | ✅ PASS |
| **Query Throughput** | `28018.82 req/sec` | `> 200 req/sec` | ✅ PASS |
| **Failure Rate** | `0.00%` | `0.00%` | ✅ PASS |

---

## 2. Latency Distribution (Percentiles)

| Percentile | Latency (ms) | Target Ceiling | SLA Status |
| :--- | :---: | :---: | :---: |
| **Min** | `0.047 ms` | — | — |
| **p50 (Median)** | `0.085 ms` | `< 15.0 ms` | ✅ COMPLIANT |
| **p90** | `0.350 ms` | `< 30.0 ms` | ✅ COMPLIANT |
| **p95** | `3.664 ms` | `< 50.0 ms` | ✅ COMPLIANT |
| **p99** | `13.664 ms` | `< 80.0 ms` | ✅ COMPLIANT |
| **Max** | `16.347 ms` | `< 150.0 ms` | ✅ COMPLIANT |

---

## 3. Workload Composition

- **50% Single-Record Lookups**: Root fields + unpaginated companion lateral rollups (`SUM(cost)`, `COUNT(*)`).
- **25% Deep Child Filtering**: Multi-condition filters (`status = 'ACTIVE'`, `cost >= 100`) with parameterized variable bindings.
- **15% Child Slice Pagination**: Page 2 offsets with custom ordering (`ORDER BY (c.attributes->>'col') DESC`).
- **10% Root Entity Pagination**: Page windowing (`LIMIT 20 OFFSET N`) with dynamic count queries.
