# 168: Establish Absolute Rule for Deterministic Rendering & Handshake Backpressure

## 1. Context & Rationale
To guarantee distributed rendering scalability across multi-core temporal chunks and cloud workers, the Universal Video IR rendering pipeline requires an inviolable hard constraint preventing any drift in frame determinism or asynchronous buffer overrun.

Per the rule management SOP:
- Detailed design rationale and specifications were recorded in Section 17 of `docs/master_rules_reference.md`.
- A compact, hard constraint `DETERMINISTIC-HANDSHAKE-BACKPRESSURE` was codified in `.agents/rules/01-workspace-specific.md`.

---

## 2. Hard Constraint Specifications

1. **Pure Discrete Frame Math**:
   - In all headless IR renderers and modifier plugins (`renderClipSpace`, `renderStreamSpace`, `renderMasterComposite`), all motion, oscillations, particle updates, camera sweeps, and word highlighting must be pure functions of `localFrame`, `globalFrame`, or discrete `timeSec = globalFrame / fps`.
   - Never use `Date.now()`, `performance.now()`, `Math.random()`, or wall-clock timers.
   - All pseudo-randomness must derive from seeded `DeterministicNoiseGenerator`.
2. **Inviolable Synchronous Handshake Backpressure**:
   - In `IRMasterRenderer.render`, `await this.lock.acquire(f)` and `this.lock.acknowledge(f)` cannot be bypassed or decoupled into un-awaited background tasks.
   - Frame $t+1$ cannot overwrite memory or render until Frame $t$ is acknowledged by the encoder sink.
3. **Bit-Identical Parity Verification**:
   - Any optimization must pass the regression invariant: `res1.cumulativeHash === res2.cumulativeHash` across identical consecutive runs.
