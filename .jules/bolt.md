## 2024-05-18 - [Avoid synchronous I/O blocking the event loop]
**Learning:** Found that `fs.readFileSync`, `fs.existsSync`, and `fs.writeFileSync` block the Node.js event loop, causing severe performance issues. According to the PERFORMANCE-TUNING rule, asynchronous file I/O operations must be used.
**Action:** Replaced synchronous I/O operations with `fs.promises.readFile`, `fs.promises.writeFile`, and the `fileExists` utility from `@acc/core` in `packages/effect-engines/src/sound-effects/engine.ts`.
## 2024-04-12 - Synchronous File I/O Blockage
**Learning:** `fs.existsSync`, `fs.mkdirSync`, and `fs.writeFileSync` were found blocking the event loop in `GenerativeAIFacade.ts`, `VoiceIsolationCloningStrategy.ts`, and `FreesoundClient.ts`.
**Action:** Replace all occurrences of synchronous fs functions with `fs.promises` or the custom `await fileExists` utility to unblock the main Node.js thread.
