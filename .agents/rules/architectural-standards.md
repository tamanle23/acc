# Architectural Standards & Defensive Coding Rule

**Context:** The project is migrating towards an isolated Middleware Pipeline Architecture (as defined in `docs/ARCHITECTURE_VISION.md`). To prevent the monolithic core (`src/renderer.ts`) from becoming more fragile during this transition, all agents must strictly adhere to these architectural standards.

### The Constraint

When implementing new features, modifying rendering logic, or adding AI components (like TTS, Upscaling, or 3D Depth):

1. **Defensive Fallbacks are Mandatory**: 
   - Never allow an experimental feature or sub-process to crash the main execution loop. 
   - **Rule:** You MUST wrap all external, volatile, or heavy operations in `try/catch` blocks.
   - **Rule:** The `catch` block MUST log a warning and provide a seamless fallback (e.g., if AI upscaling fails, fallback to the original image; if 3D depth fails, fallback to 2D rendering).

2. **Respect State Immutability**:
   - Avoid destructive in-place mutations on the core `ResolvedStoryConfig` or `Scene` objects where possible. 
   - If a feature generates a new asset (e.g., an upscaled image or generated audio), do not blindly overwrite the original file path. Maintain the original asset as a fallback option.

3. **FFmpeg Filtergraph Hygiene**:
   - When building `filter_complex` strings, be extremely rigorous with stream labels (e.g., `[v_out_1]`).
   - **Rule:** Never reuse generic stream names. Always append unique identifiers or indexes to stream labels to prevent naming collisions that will instantly crash FFmpeg.
   - Avoid deeply nested, unreadable string concatenations. Break complex filtergraphs down into logical, commented chunks or arrays before joining them.

4. **Align with the Vision**:
   - Before designing a new massive feature inside `renderer.ts`, review `docs/ARCHITECTURE_VISION.md` to ensure your implementation moves the codebase toward modularity rather than adding to the monolith.
