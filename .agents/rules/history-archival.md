---
trigger: always_on
description: Mandatory rule to archive numbered historical implementation plans and walkthroughs in docs/history/ for every change.
---

# Numbered History Archival Rule

For **EVERY change** in the codebase (from minor bug fixes to major feature enhancements):

1. **Numbered Record File (`docs/history/XXX_<task_description>.md`)**:
   - Create a dedicated history record file in `docs/history/` with sequential 3-digit numbering (`001_...`, `002_...`, `003_...`).
   - Format:
     - **# [XXX] Task Title**
     - **1. Context & Problem Statement**: What was requested/broken.
     - **2. Implementation Plan**: Architectural design, 8-point synchronization checklist.
     - **3. Changes Made**: Detailed list of modified files and diff summaries.
     - **4. Verification & Walkthrough**: Test commands executed, benchmark results, CLI logs.
2. **Maintain History Index (`docs/history/README.md`)**:
   - Update the table of historical changes with ID, Title, Date, and Scope.
3. **Git Commit Protocol**:
   - Once testing is verified and the history file is written, you MUST commit the changes to Git.
   - Run `git add .` followed by `git commit -m "[XXX] Task Title" -m "Brief description..."` using the matching 3-digit history ID.
