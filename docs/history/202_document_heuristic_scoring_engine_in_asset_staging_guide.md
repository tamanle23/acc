# 202. Document Heuristic Scoring Engine in Asset Staging Guide

## 📌 Metadata
- **ID**: `202`
- **Date**: `2026-10-14`
- **Scope**: Documentation (`docs/guide/AUTO_CONFIG_ASSET_STAGING_GUIDE.md`)
- **Status**: Completed

---

## 🎯 Context & Requirements
The user requested adding the analysis of how the **Heuristic Score** works in `auto-config` into [`docs/guide/AUTO_CONFIG_ASSET_STAGING_GUIDE.md`](docs/guide/AUTO_CONFIG_ASSET_STAGING_GUIDE.md).

---

## 🛠️ Implementation Details
1. **Added Section 2: Heuristic Scoring Engine & Probabilistic Evaluation**:
   - Documented the 3-step evaluation cycle: MediaAssetProberChain Crawl $\to$ Multi-Strategy Confidence Scoring $\to$ Descending Candidate Sort & Archetype Selection.
   - Built a comprehensive threshold scoring table detailing exact confidence scores ($0.02 \dots 1.00$) and triggering manifest conditions for all 6 pipelines:
     - Pipeline 1: Scraper & Summarizer ($0.05 \dots 0.95$)
     - Pipeline 2: DB & Dynamic Templating ($0.02 \dots 0.95$)
     - Pipeline 3: Repurposing Recycler ($0.05 \dots 0.95$)
     - Pipeline 4: Generative Storytelling ($0.25 \dots 1.00$)
     - Pipeline 5: Rule-Logic & Procedural ($0.05 \dots 0.98$)
     - Pipeline 6: Ambient Loops ($0.05 \dots 0.96$)
   - Documented winner resolution, manual user override behavior (`--pipeline <id>`), and the empty folder baseline fallback to Pipeline 4.
2. **Updated Table of Contents & Section Numbering**:
   - Renumbered sections 2 through 8 cleanly to preserve document hierarchy.
3. **Indexed in History**:
   - Recorded in `docs/history/202_document_heuristic_scoring_engine_in_asset_staging_guide.md` and indexed in `docs/history/README.md`.

---

## 🧪 Verification
- Verified markdown rendering, diagram boxes, and table layouts.
- Verified test suites remain green.
