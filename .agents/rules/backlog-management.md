# Backlog Management & Incremental Tracking Rule

**Context:** Features, architectural refactors, and technical debt are frequently deferred to the project backlog. Without a standardized, incremental convention, backlog items become disorganized, orphaned, or unverified against implemented work.

---

### The Mandatory Constraints

#### 1. Incremental Numbering Protocol
* Whenever an idea, feature, or refactor is added to the backlog:
  - Assign a sequential 3-digit number (`001`, `002`, `003`, etc.).
  - Create a dedicated markdown file in `docs/backlogs/XXX_<epic_name>.md`.
* Each backlog file **MUST** contain:
  - Header metadata: `Status` (initially `⏳ [ ] Planned`), `Component`, `Created Date`, `Completed Date`, `Linked History`.
  - **Context & Problem Statement**: Why this is needed and what problem it solves.
  - **Proposed Design & Implementation Ideas**: Architectural sketch and key concepts.
  - **Acceptance Criteria**: Checkbox list defining what constitutes completion.

#### 2. Master Backlog Index Synchronization (`docs/backlogs/README.md`)
* Every backlog item **MUST** be recorded in the master table at `docs/backlogs/README.md`.
* The table must maintain: ID, Title, Component, Status (`Planned` vs `Completed`), Created Date, and Linked History.

#### 3. Completion Marking Protocol (Zero Orphan Epics)
* When ANY implementation task is completed that fulfills a backlog item:
  - Open the corresponding `docs/backlogs/XXX_<epic_name>.md` file.
  - Change status to `✅ [x] Completed`.
  - Fill in `Completed Date` and add a link to the History record: `Linked History: [YYY_...md](../history/YYY_...md)`.
  - Mark checkboxes `[x]` in the Acceptance Criteria.
  - Update `docs/backlogs/README.md` status column to `✅ Completed` and link to the history file.

#### 4. Never Create Unnumbered Dump Files
* Do not dump unformatted notes into generic text files. All future items must follow the sequential incremental convention in `docs/backlogs/`.
