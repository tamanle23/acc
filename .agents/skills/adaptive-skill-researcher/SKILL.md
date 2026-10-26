---
name: adaptive-skill-researcher
description: Automatically bridge knowledge gaps, overcome isolated skill limitations, and dynamically expand existing skills through live research. Trigger alongside any active domain skill when encountering unfamiliar APIs, new library versions, undocumented edge cases, cross-domain integrations, or tasks that exceed the active skill's static instructions.
---
# Adaptive Skill Researcher & Expander

A meta-skill designed to co-activate alongside specialized domain skills whenever a task pushes past the static boundaries, version knowledge, or isolated scope of the active skill.

## When to Use

- An active skill is invoked, but the user's request involves an unfamiliar library, a newer framework version, or an edge case not covered in that skill's instructions
- A task requires bridging two or more isolated domains (e.g., combining a UI skill with a backend streaming protocol or hardware acceleration pipeline)
- An existing skill's instructions fail, produce deprecation warnings, or lack specific implementation details for a real-world constraint
- Dynamically upgrading an existing skill with newly verified patterns so it does not hit the same limitation twice

## Steps

### 1. Detect Skill Boundaries and Isolation Gaps

When working with an active domain skill, evaluate its coverage before generating the final solution:

- **Inventory Active Constraints:** Note the active skill's architectural rules, coding conventions, and preferred libraries so any researched addition remains 100% compatible.
- **Pinpoint the Gap:** Explicitly isolate what is missing from the active skill (e.g., a breaking API change, an unhandled runtime environment, or a cross-stack integration point).
- **Avoid Hallucinated Extrapolation:** Never guess or invent APIs when a skill's static instructions run out. Immediately pivot to live verification.

### 2. Execute Context-Anchored Research

Run targeted searches constrained by the active skill's tech stack and environment:

- **Query Formulation:** Combine the missing capability with the exact runtime, version, and libraries defined in the active skill.
- **Primary Source Verification:** Prioritize official documentation, release notes, RFCs, and source definitions over generic community snippets.
- **Cross-Domain Alignment:** If bridging two skills (such as `mediabunny-web` and `react-ui-performance-v2`), research the exact handoff boundary (e.g., transferring `OffscreenCanvas` or `VideoFrame` references across Web Workers without copying memory).

### 3. Synthesize Within the Active Skill's Idioms

Translate raw research findings so they look and behave like a native part of the active skill:

- **Enforce Existing Conventions:** Wrap newly researched APIs in the error-handling, typing, and structural patterns mandated by the active skill (and `enterprise-clean-coder` if applicable).
- **Verify Compatibility:** Ensure the researched solution does not violate the active skill's core invariants (such as main-thread safety, immutability, or zero-copy streaming).

### 4. Persist the Expansion Back to the Skill

Once the gap is resolved to solve the user's immediate request, expand the limited skill so the knowledge is retained permanently:

- **Modular Reference Injection:** When a domain skill hits a specialized sub-topic limitation, package the newly verified pattern as a concise Markdown resource (e.g., `references/<subtopic>.md`) using `skills:write_skill_file` on the target skill, or propose a direct skill upgrade.
- **Keep Expansions Atomic:** Record only the generalized pattern, trigger context, and verified code template. Strip out one-off session variables or conversational fluff.
- **Notify the User:** Briefly mention which limitation was bridged via live research and offer to commit the newly discovered pattern permanently into the target skill.

## Gotchas

- Never let live research override the architectural quality bars of the active skill (for example, do not paste raw, unvalidated documentation snippets that ignore strict typing or resource cleanup).
- Do not trigger skill updates for trivial one-off business logic; only expand a skill when the discovered pattern is reusable across future tasks in that domain.
