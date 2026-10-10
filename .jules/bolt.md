## 2024-05-18 - [Avoid synchronous I/O blocking the event loop]
**Learning:** Found that `fs.readFileSync`, `fs.existsSync`, and `fs.writeFileSync` block the Node.js event loop, causing severe performance issues. According to the PERFORMANCE-TUNING rule, asynchronous file I/O operations must be used.
**Action:** Replaced synchronous I/O operations with `fs.promises.readFile`, `fs.promises.writeFile`, and the `fileExists` utility from `@acc/core` in `packages/effect-engines/src/sound-effects/engine.ts`.
## 2024-04-12 - Synchronous File I/O Blockage
**Learning:** `fs.existsSync`, `fs.mkdirSync`, and `fs.writeFileSync` were found blocking the event loop in `GenerativeAIFacade.ts`, `VoiceIsolationCloningStrategy.ts`, and `FreesoundClient.ts`.
**Action:** Replace all occurrences of synchronous fs functions with `fs.promises` or the custom `await fileExists` utility to unblock the main Node.js thread.
## 2026-10-08 - [Asynchronous Refactoring of Exporters]
**Learning:** Replaced synchronous I/O operations (`fs.readFileSync`, `fs.existsSync`, etc.) with asynchronous alternatives (`fs.promises`, `fileExists` utility) in `AudioExporter.ts` to align with PERFORMANCE-TUNING directives. Discovered that using `Promise.all()` mapping over a list of files enables parallel file reading, significantly reducing cumulative wait time compared to synchronous reads. Furthermore, FFmpeg dependencies often need manual intervention via `apt` in test environments prior to executing tests involving FFI implementations.
**Action:** Prioritize checking for `fs.*Sync` usage during refactoring and replace with non-blocking alternatives using `Promise.all()` for batch I/O operations where feasible. Add FFmpeg dependencies via `apt` as a standard troubleshooting step before running test suites.
