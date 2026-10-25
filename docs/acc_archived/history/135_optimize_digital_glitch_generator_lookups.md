# Optimize Digital Glitch Generator Lookups

## What
Refactored the `DigitalGlitchEffect` block lookup mechanism inside `packages/effect-engines/src/overlay-effects/generators/digital_glitch.ts`. Instead of performing an O(N) array search on every frame iteration via `Array.filter` and `Array.find`, the blocks are now pre-grouped by their `frame` property into an O(1) `Map<number, GlitchBlock[]>` data structure.

## Why
The original code repeatedly scanned all glitch blocks for matches every single frame. This O(N*M) lookup scales poorly with the number of generated frames (M) and the number of blocks (N), leading to unnecessary CPU load. The pre-grouped Map design isolates the lookup cost up front, allowing instant O(1) access inside the performance-critical rendering loop.

## Benchmark Results
To confirm this, an explicit microbenchmark was introduced in `benchmarks/micro/digital-glitch.bench.ts`. Utilizing the `mitata` library simulating 10,000 frames, we observed:
* **Baseline (O(N*M) Array.filter):** ~633 ms / iter
* **Optimized (O(1) Map Lookup):** ~0.265 ms / iter

This represents an approximate 2,388x improvement for the lookup overhead, ensuring much lower latencies when executing the canvas frame rendering routines.
