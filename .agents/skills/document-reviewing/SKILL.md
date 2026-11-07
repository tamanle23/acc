---
name: document-reviewing
description: Conduct rigorous, structured reviews of documents, reports, specifications, proposals, and articles. Use when the user asks to review, audit, fact-check, critique, or evaluate a document for factual accuracy, evidence strength, internal consistency, and logical flow.
---
# Document Reviewing

A strict, systematic workflow for scanning documents, comprehending core arguments, verifying facts and evidence, and auditing the logical progression of ideas.

## When to Use

- The user uploads or pastes a document (report, RFC, specification, proposal, whitepaper, essay, or research summary) and asks for a review or audit.
- The user wants to verify claims, data points, citations, and evidence within a text.
- The user asks to evaluate reasoning quality, logical flow, structural coherence, or hidden assumptions in a written piece.

## Core Review Workflow

Execute every document review in four sequential passes so that structural comprehension precedes granular fact-checking and logic auditing.

### Step 1: Structural Scan and Comprehension Pass

Read the entire document to map its architecture before critiquing individual lines.

1. Identify the document's core thesis, primary objective, and target audience.
2. Map the section-by-section outline and summarize what each section claims to accomplish.
3. Extract all explicit assumptions, scope boundaries, and success criteria stated by the author.
4. Flag any structural gaps where promised topics or sections are missing, incomplete, or left as placeholders.

### Step 2: Fact and Evidence Verification Pass

Isolate every empirical claim, statistic, citation, and technical assertion for verification.

1. **Categorize Claims:** Separate verifiable objective facts (metrics, dates, external citations, technical constraints) from subjective opinions or strategic projections.
2. **Audit Internal Evidence:** Check whether data tables, charts, appendices, and inline numbers agree with one another across the document. Recalculate totals, percentages, and growth rates independently to catch arithmetic discrepancies.
3. **Verify External Facts:** Use available search or reference tools to cross-check external citations, industry benchmarks, historical facts, and technical capabilities.
4. **Grade Evidence Sufficiency:** Mark each major claim with an evidence status:
   - `Verified`: Supported by accurate internal calculations or reliable external sources.
   - `Unsupported`: Asserted as fact without citation, data, or proof.
   - `Contradicted`: Conflicts with internal data elsewhere in the document or verified external facts.
   - `Outdated/Ambiguous`: Relies on stale data, vague quantifiers ("many", "significant"), or unverified assumptions.

### Step 3: Thinking Flow and Logic Audit Pass

Evaluate whether the conclusions follow validly from the premises and evidence.

1. **Trace the Argument Chain:** Map the progression from `Problem Statement -> Evidence/Analysis -> Proposed Solution -> Expected Outcome`. Verify that each step directly supports the next.
2. **Detect Logical Fallacies and Jumps:**
   - **Non-sequiturs:** Conclusions that do not follow from the preceding evidence.
   - **Correlation vs. Causation:** Assuming a trend caused an outcome without ruling out confounding factors.
   - **Survivorship or Selection Bias:** Cherry-picking favorable case studies while ignoring counterexamples.
   - **Circular Reasoning:** Restating the premise as the conclusion rather than proving it.
   - **False Dichotomies:** Presenting only two extreme options when viable middle-ground alternatives exist.
3. **Stress-Test Unstated Assumptions:** Identify what must be true in the real world for the author's proposal or argument to succeed, and assess whether those conditions are realistic.
4. **Check Narrative Cohesion:** Ensure transitions between sections are logical, terminology remains consistent throughout, and the conclusion aligns with the introduction.

### Step 4: Synthesize the Review Report

Present findings in a structured, actionable report rather than a scattered list of comments.

1. **Executive Verdict:** State clearly in 2-3 sentences whether the document is sound, requires minor revisions, or has critical factual/logical flaws.
2. **Core Thesis & Comprehension Summary:** Briefly state what the document argues and how it is structured to confirm full alignment.
3. **Fact & Evidence Audit Table:** List key claims, their location/section in the document, verification status (`Verified`, `Unsupported`, `Contradicted`, `Ambiguous`), and concrete findings or corrections.
4. **Thinking Flow & Logic Critique:** Detail structural gaps, logical leaps, internal contradictions, and unexamined risks in priority order (`Critical`, `Major`, `Minor`).
5. **Actionable Revision Checklist:** Provide specific, concrete edits the author should make to resolve every identified issue.

## Gotchas

- **Do not confuse style with substance:** Prioritize factual accuracy, evidence strength, and logical validity over minor grammar or phrasing preferences unless copy-editing is explicitly requested.
- **Never trust inline math blindly:** Always recompute percentages, sums, and financial or technical projections independently before marking them verified.
- **Anchor every critique:** Reference the exact section heading, paragraph, or quote when flagging a factual error or logical flaw so the author can locate and fix it immediately.
