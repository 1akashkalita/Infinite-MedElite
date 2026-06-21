# Project Retrospective — Infinite

A living retrospective across milestones. Newest milestone section first; cross-milestone trends at the bottom.

## Milestone: v1.0 — MVP

**Shipped:** 2026-06-21
**Phases:** 7 | **Plans:** 22 | **Tasks:** 41 | **Live:** https://infinite-medelite.vercel.app

### What Was Built
A single-flow app that turns a CCN into a polished, downloadable nursing-home assessment report (live web preview + PDF + .docx) from public CMS Care Compare data, with a clickable Medicare link. All required features plus every committed bonus: 12 claims-based hospitalization/ED metrics, .docx export, color-banded star glyphs and grouped bar charts across all three renderers, a 300ms live-preview debounce, and hardened error handling — all on one Zod-validated shared `ReportViewModel`.

### What Worked
- **One shared view-model driving all three renderers** kept the web preview, PDF, and .docx consistent by construction — the integration checker confirmed zero divergence paths.
- **Fixture-first data layer** (capture CMS JSON before writing any field name) made the Zod schemas trustworthy and caught the `qm_rating` vs longstay/shortstay distinction early.
- **Rendering-based verification** (poppler for PDF, LibreOffice for .docx) caught visual defects that passing tests missed — the project's "render & look" rule earned its keep.
- **Live-Vercel SC#4 smoke as a hard gate** surfaced two serious production-only bugs that every local test suite passed over.

### What Was Inefficient
- **Two production-only bugs cost a full debugging cycle each** because the test suite runs unbundled source (vitest) while Vercel serves the `next build` bundle. The Turbopack `+`-literal mangling and the `@resvg` missing-Lambda-fonts issue were both invisible until artifacts were pulled from the live URL.
- **Deploy friction:** the repo rename (Infinite-Snapshot → Infinite-MedElite) silently retired the old Vercel alias and broke SSH push; resolved by pushing over HTTPS via the `gh` token and discovering the new `infinite-medelite.vercel.app` host mid-audit.
- **Metadata lag:** SUMMARY `requirements-completed` frontmatter was mostly left empty and Phase 2's traceability checkboxes stayed "Pending" despite passing verification — the 3-source cross-reference flagged false "partials" that needed manual reconciliation.

### Patterns Established
- **TURBOPACK-FOLD-01:** build OOXML/XML fragments as single template literals, never `+`-chained literals (the prod minifier drops fragments).
- **RESVG-FONT-01:** embed a font subset + `loadSystemFonts:false` for any serverless SVG→PNG rasterization (Lambda has no system fonts).
- **Verify against the production build**, not just vitest, for anything that renders to a binary artifact.

### Key Lessons
- A green test suite is necessary but not sufficient for serverless rendering — always pull and inspect a real artifact from the deployed URL before declaring done.
- Renaming a repo can move/retire the deployment host; check the live URL after any rename.

### Cost Observations
- Model mix: primarily sonnet (executors, verifier, reviewers, integration checker) under an opus orchestrator.
- Notable: most wall-clock in v1.0's tail went to live-deploy debugging of the two production-only bugs, not feature work.

## Cross-Milestone Trends

_(Populated from v1.1 onward.)_

| Milestone | Phases | Plans | Tasks | Blockers at audit |
|-----------|--------|-------|-------|-------------------|
| v1.0 MVP | 7 | 22 | 41 | 0 |
