---
trigger: always_on
---
rule: backlog_tracking
constraints:
  - id: sequential 3-digit (001, 002); no unnumbered dumps
  - create: docs/backlogs/XXX_<epic>.md
    meta: [Status ( [ ] Planned), Component, Created Date, Completed Date, Linked History]
    sections: [Context & Problem, Proposed Design, Acceptance Criteria (checkboxes)]
  - index: docs/backlogs/README.md
    fields: [ID, Title, Component, Status, Created Date, Linked History]
  - complete:
      file: set Status ([x] Completed), add Completed Date, link Linked History (../history/YYY_...md), mark checkboxes
      index: update Status (Completed) and Linked History