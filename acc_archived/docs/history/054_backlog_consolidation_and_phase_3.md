# [054] Backlog Consolidation & Phase 3 Specification

**1. Context & Problem Statement**: 
Following the completion of Phase 1 and Phase 2 of the Architecture Vision (`docs/ARCHITECTURE_VISION.md`), the user requested:
1. Moving all backlog files into a dedicated centralized directory: `docs/backlogs/`.
2. Documenting Phase 3 (The Pipeline Orchestrator) into the project backlog as an actionable future epic.
3. Updating cross-references and documentation links.

**2. Implementation Plan**: 
- Create directory `docs/backlogs/`.
- Use `git mv` to relocate `docs/BACKLOG.md` and `docs/3D_DEPTH_BACKLOG.md` into `docs/backlogs/`.
- Update `docs/backlogs/BACKLOG.md` with **Epic 7: Isolated Pipeline Architecture (Phase 3 - The Pipeline Orchestrator)**.
- Update `README.md` to reference `docs/backlogs/3D_DEPTH_BACKLOG.md` and `docs/backlogs/BACKLOG.md`.
- Document in history and commit changes.

**3. Changes Made**: 
- **`docs/backlogs/`**: Created directory for centralized backlog tracking.
- **`docs/backlogs/BACKLOG.md`**:
  - Moved from `docs/BACKLOG.md`.
  - Added **Epic 7: Isolated Pipeline Architecture (Phase 3 - The Pipeline Orchestrator)** detailing `PipelineRunner`, `IPlugin` middleware orchestration, dry-run mode (`ffmpeg -f null -`), and sub-process sandboxing (Actor model).
- **`docs/backlogs/3D_DEPTH_BACKLOG.md`**: Moved from `docs/3D_DEPTH_BACKLOG.md`.
- **`README.md`**: Updated documentation links to point to the new `docs/backlogs/` path.

**4. Verification & Walkthrough**: 
- Verified directory structure and file moves via `git status`.
- Verified updated links in `README.md`.
- Both backlog documents are now organized under `docs/backlogs/`.
