---
name: deep-research-synthesizer
description: Conduct rigorous, multi-source research, cross-verify facts, and synthesize actionable mental models, trade-off matrices, and reusable specifications. Use when investigating unfamiliar technologies, deep-diving into complex domains, comparing competing architectures, or gathering authoritative knowledge to create, expand, or update other skills.
---
# Deep Research Synthesizer

A general-purpose research and knowledge distillation skill for investigating complex topics, verifying primary sources, and structuring findings into actionable deliverables or modular blueprints that extend other skills.

## When to Use

- Investigating unfamiliar libraries, APIs, protocols, scientific concepts, or industry standards
- Comparing competing tools, architectures, or methodologies with objective trade-off matrices
- Auditing rapidly evolving domains where pre-trained assumptions may be outdated
- Gathering, structuring, and distilling domain expertise to author a new skill or upgrade an existing skill

## Steps

### 1. Deconstruct the Research Objective

Break the target topic into four orthogonal inquiry vectors before searching:

- **Core Mechanics and First Principles:** How the system, concept, or domain works under the hood.
- **Current Standards and Idioms:** The latest stable versions, official best practices, and canonical patterns.
- **Trade-offs and Constraints:** Performance bottlenecks, resource limits, security implications, and when not to use it.
- **Failure Modes and Edge Cases:** Common pitfalls, breaking changes, and silent bugs encountered in real-world usage.

### 2. Gather and Triangulate Primary Sources

Execute targeted searches prioritizing authoritative hierarchy over secondary commentary:

1. **Tier 1 (Primary):** Official documentation, API specifications, RFCs, source repositories, and peer-reviewed data.
2. **Tier 2 (Empirical):** Production post-mortems, reproducible benchmarks, maintainer discussions, and issue trackers.
3. **Tier 3 (Community):** Tutorials and blog posts (use only to identify user pain points, never as sole proof of behavior).

Cross-verify conflicting claims across at least two independent sources. Explicitly flag any unverified assumptions, version-specific behaviors, or deprecated patterns.

### 3. Synthesize into Structured Knowledge

Transform raw information into high-signal, scannable artifacts rather than walls of text:

- **Executive Mental Model:** A 2-3 sentence summary explaining what the subject is and the core problem it solves.
- **Decision and Trade-off Matrix:** A Markdown table comparing options across concrete dimensions (e.g., latency, complexity, ecosystem maturity, memory footprint).
- **Canonical Implementation / Workflow:** Verifiable, production-ready code blocks or step-by-step procedures demonstrating the happy path.
- **Constraints and Anti-Patterns:** Explicit rules detailing what to avoid and why.

### 4. Distill for Skill Extension (Modular Output Mode)

When the research is intended to build, enrich, or update another skill, package the findings into a skill-ready blueprint:

- **Trigger Scenarios:** Specific user intents, keywords, and problem contexts where the researched knowledge applies.
- **Deterministic Heuristics:** Convert vague advice into testable imperative rules (e.g., "Use X when payload exceeds Y MB; otherwise default to Z").
- **Minimal Reproducible Templates:** Self-contained, zero-placeholder code or configuration snippets that an agent can apply directly.
- **Verification Criteria:** Exact CLI commands, assertions, or checklists to confirm the researched pattern was applied correctly.
- **Skill Integration Path:** Identify whether the distilled knowledge should be appended as a new section in `SKILL.md`, saved as an auxiliary reference file in the target skill, or spun out as a standalone skill.

## Gotchas

- Avoid echoing outdated tutorials when a library or specification has undergone a major version shift; always verify the current release version first.
- Do not present opinionated preferences as universal laws; always pair recommendations with the specific context or constraint that justifies them.
- When extending another skill, ruthlessly prune background history and introductory fluff so the target skill remains concise and token-efficient.
