---
name: soa-aosoa-programming
description: Architect, implement, refactor, and optimize Data-Oriented data structures using Structure-of-Arrays (SoA) and Array-of-Structures-of-Arrays (AoSoA / Tiled SoA). Use when the user asks to optimize memory layout, transition from AoS to SoA or AoSoA, write SIMD-vectorized loops, align data to CPU cache lines (64 bytes), structure high-performance ECS component storage, or build typed contiguous buffers in C, C++, Rust, Zig, or TypeScript/JavaScript TypedArrays.
---
# soa-aosoa-programming

Architect, implement, and benchmark Structure-of-Arrays (SoA) and Array-of-Structures-of-Arrays (AoSoA) memory layouts for high-throughput, cache-efficient computing and SIMD vectorization.

## When to Use

* Refactoring an existing Array-of-Structures (AoS) object model into SoA or AoSoA for CPU cache performance.
* Writing auto-vectorizable or explicit SIMD algorithms (AVX2, AVX-512, ARM NEON, WebAssembly SIMD) targeting contiguous memory chunks.
* Designing high-throughput Entity Component System (ECS) storage archetypes, sparse sets, or particle and physics buffers.
* Managing flat binary memory in low-level languages (C, C++, Rust, Zig) or managed runtimes using WebAssembly and TypeScript TypedArrays / ArrayBuffers.
* Resolving false sharing, cache line straddling, or memory bus starvation caused by wide, interleaved records.

## Core Workflow and Architecture Steps

### 1. Identify Access Patterns and Hot/Cold Separation

* Analyze whether data fields are accessed simultaneously in tight inner loops.
* Extract cold metadata (debug labels, entity UUIDs, non-physics state) into disjoint structures.
* Group frequently mutated numeric fields (such as positions, velocities, accelerations) into aligned SoA arrays.

### 2. Select Layout Architecture: Pure SoA vs. AoSoA (Tiled SoA)

* Choose Pure SoA when:

  - Iteration runs over the entire collection in simple linear sweeps.
  - Number of entities fluctuates dynamically or is unbounded.
  - Target hardware SIMD width varies or runtime compiler auto-vectorization suffices.

* Choose AoSoA (Tiled SoA) when:

  - Explicit SIMD intrinsics (AVX2, AVX-512, NEON) require fixed-width chunks.
  - Frequent random access or entity insertion/removal benefits from localized chunk boundaries.
  - Sizing chunks to match hardware register width (4 for NEON/SSE, 8 for AVX2, 16 for AVX-512) prevents partial register masking and eliminates scalar remainder loops.

### 3. Align to Hardware Cache Lines (64 Bytes)

* Ensure chunk byte footprints divide or multiply evenly into 64-byte CPU cache lines.
* Example: A chunk of 8 float32s is 32 bytes (half a cache line). Four attributes of 8 float32s span exactly 128 bytes (two full cache lines).
* Enforce explicit alignment using language primitives:

  - C/C++: `alignas(64)` or `alignas(32)`.
  - Rust: `#[repr(align(64))]` or `#[repr(C, align(32))]`.
  - Zig: `align(64)`.
  - TypeScript: Allocate a single `ArrayBuffer` with byte offset multiples of 64 or 32, wrapping sub-slices in typed views (`Float32Array`, `Int32Array`).

### 4. Implement Contiguous SIMD Iteration

* Ensure inner loops have simple, branchless arithmetic suitable for fused multiply-add (FMA).
* Prevent pointer aliasing so compilers can auto-vectorize:

  - C/C++: Use `__restrict__` on array pointers.
  - Rust: Leverage non-overlapping mutable slices.

* For explicit vectorization, load directly with SIMD vector intrinsics (`_mm256_load_ps`, `vld1q_f32`, `wasm_v128_load`) without interleaving or gather/scatter steps.

### 5. Implement Efficient Entity Deletion and Insertion

* Use swap-and-pop for unordered SoA entity removal: swap the deleted index with the tail index across every parallel field array, then decrement the count.
* For AoSoA, keep a bitmask or occupancy counter per chunk, or swap-and-pop within chunk slots.

## Gotchas and Failure Modes

* Cache line straddling: Ensure data structures do not cross 64-byte boundaries unaligned, which forces the CPU memory controller to dispatch two cache line requests for a single SIMD register load.
* Array synchronization drift: Adding or removing an entity in Pure SoA requires updating all parallel arrays simultaneously. Wrap mutation methods in transactional APIs to prevent out-of-sync array lengths.
* Pointer chasing: Avoid storing pointers or indirect references inside SoA fields. Fields must be primitive scalars or fixed-size value types.
* Premature SoA for cold paths: Transforming low-iteration, branching code into SoA increases cognitive complexity without improving execution speed. Benchmark before and after.
