## 2024-05-18 - [Avoid synchronous I/O blocking the event loop]
**Learning:** Found that `fs.readFileSync`, `fs.existsSync`, and `fs.writeFileSync` block the Node.js event loop, causing severe performance issues. According to the PERFORMANCE-TUNING rule, asynchronous file I/O operations must be used.
**Action:** Replaced synchronous I/O operations with `fs.promises.readFile`, `fs.promises.writeFile`, and the `fileExists` utility from `@acc/core` in `packages/effect-engines/src/sound-effects/engine.ts`.
