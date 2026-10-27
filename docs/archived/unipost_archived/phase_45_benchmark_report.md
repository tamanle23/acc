# Phase 45: Enterprise Resilience & Performance Benchmark Report

**Generated At**: 2026-10-19T17:56:36.713564700Z
**Environment**: Spring Modulith / Java 21 / PostgreSQL Lateral AST Compiler
**Test Suite**: `CompositeQueryPerformanceBenchmarkTest`

---

## 1. Concurrency & Throughput Metrics

| Metric | Result | Target Baseline | Status |
| :--- | :---: | :---: | :---: |
| **Total Concurrent Queries** | `1000` | `1,000` | ✅ PASS |
| **Active Worker Threads** | `32` | `32` | ✅ PASS |
| **Total Duration** | `0.01 sec` | `< 10 sec` | ✅ PASS |
| **Query Throughput** | `67894.19 req/sec` | `> 200 req/sec` | ✅ PASS |
| **Failure Rate** | `0.00%` | `0.00%` | ✅ PASS |

---

## 2. Latency Distribution (Percentiles)

| Percentile | Latency (ms) | Target Ceiling | SLA Status |
| :--- | :---: | :---: | :---: |
| **Min** | `0.025 ms` | — | — |
| **p50 (Median)** | `0.097 ms` | `< 15.0 ms` | ✅ COMPLIANT |
| **p90** | `0.231 ms` | `< 30.0 ms` | ✅ COMPLIANT |
| **p95** | `0.636 ms` | `< 50.0 ms` | ✅ COMPLIANT |
| **p99** | `1.358 ms` | `< 80.0 ms` | ✅ COMPLIANT |
| **Max** | `2.299 ms` | `< 150.0 ms` | ✅ COMPLIANT |

---

## 3. Workload Composition

- **50% Single-Record Lookups**: Root fields + unpaginated companion lateral rollups (`SUM(cost)`, `COUNT(*)`).
- **25% Deep Child Filtering**: Multi-condition filters (`status = 'ACTIVE'`, `cost >= 100`) with parameterized variable bindings.
- **15% Child Slice Pagination**: Page 2 offsets with custom ordering (`ORDER BY (c.attributes->>'col') DESC`).
- **10% Root Entity Pagination**: Page windowing (`LIMIT 20 OFFSET N`) with dynamic count queries.
