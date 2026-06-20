---
phase: 07-visualizations-polish
plan: "01"
subsystem: visualization
tags:
  - star-rating
  - pdf
  - docx
  - web-preview
  - D-15
  - VIZ-01
  - VIZ-02
  - chart-foundation

dependency-graph:
  requires:
    - "06-03 (docx template-fill, CMS view-model, CR-01 discipline)"
    - "06-02 (claims-mapper: 12 HospMetric rows in fixed order)"
  provides:
    - "STAR_BAND_HEX / STAR_BAND_WEB / CHART_SERIES color constants (shared by all renderers)"
    - "getStarBand(rating) / buildStarGlyphs(rating) pure helpers"
    - "groupByMeasure(metrics) → 4 MeasureGroup buckets in 521/522/551/552 order (Plan 02 charts)"
    - "StarRating component (web Tailwind glyphs, null→grey N/A)"
    - "PdfStarRating component (react-pdf Svg/Path 5-point star, null→grey N/A Text)"
    - "docx buildStarRunXml: colored Unicode OOXML <w:r> runs for 4 rating cells"
    - "HospMetric.measureKey + HospMetric.source (D-15 extension, all 4 mapper return paths)"
  affects:
    - "07-02 (chart grouping via groupByMeasure, CHART_SERIES colors)"

tech-stack:
  added: []
  patterns:
    - "Renderer-agnostic logic in pure .ts (star-band.ts); per-renderer thin wrappers"
    - "PdfStarRating structural test: import .tsx component into .test.ts, call as plain function, walk React element tree via recursive findByType() — no DOM/jsdom"
    - "CR-01: all .replace() calls injecting variable OOXML use callback form () => fragment"
    - "T-7-02: buildStarRunXml interpolates only closed-enum hex + integer rating — no client free-text"
    - "Pitfall 6 ordering: HospMetricSchema extended before HospMetric interface"

key-files:
  created:
    - medelite-report/src/lib/report/colors.ts
    - medelite-report/src/lib/report/star-band.ts
    - medelite-report/src/lib/report/chart-utils.ts
    - medelite-report/src/lib/report/star-band.test.ts
    - medelite-report/src/lib/report/chart-utils.test.ts
    - medelite-report/src/components/StarRating.tsx
    - medelite-report/src/components/pdf/PdfStarRating.tsx
    - medelite-report/src/components/pdf/PdfStarRating.test.ts
  modified:
    - medelite-report/src/lib/cms/types.ts
    - medelite-report/src/lib/report/view-model.ts
    - medelite-report/src/lib/cms/claims-mapper.ts
    - medelite-report/src/components/ReportPreview.tsx
    - medelite-report/src/components/pdf/ReportPDF.tsx
    - medelite-report/src/lib/docx/ReportDocx.ts
    - medelite-report/tests/api/export-docx.test.ts
    - medelite-report/tests/lib/report/view-model.test.ts

decisions:
  - "Structural test for PdfStarRating uses .test.ts (not .tsx) — Vitest node env only includes *.test.ts; imports the .tsx component as a plain function and walks the React element tree via findByType() with any-typed nodes to avoid react-pdf TypeScript opacity"
  - "PdfRatingRow added alongside PdfRow in ReportPDF.tsx — PdfRow accepts only string; a ReactNode variant avoids TypeScript error when placing PdfStarRating (returns View) in the value cell"
  - "buildStarRunXml bypasses xmlEsc entirely — glyphs are literal Unicode, only closed-enum hex and integer are interpolated; routing through xmlEsc would escape the <w:r> run tags as text (Pitfall 7)"
  - "Star row detection uses STAR_ROW_SET inside the existing xml.replace() loop (approach A) — keeps a single pass over the table rows and maintains the CR-01 callback discipline of the existing fill loop"
  - "chart-utils.groupByMeasure uses chart-section captions (not verbatim CLM-03 row labels) — the 12 flat rows remain unchanged for all three renderers; Plan 02 adds the grouped bar chart above them"

metrics:
  duration: "~3 hours (resumed from context summary)"
  completed: "2026-06-20"
  tasks-completed: 3
  tasks-total: 3
  tests-added: 50
  files-created: 8
  files-modified: 8
---

# Phase 07 Plan 01: Star Ratings + D-15 Grouping Foundation Summary

**One-liner:** Band-colored star glyphs (★★★★☆ + N/5) across web/PDF/docx via shared pure helpers, with measureKey/source added to HospMetric for Plan 02 chart grouping.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | D-15 grouping foundation + shared lib modules | `17566a7` | colors.ts, star-band.ts, chart-utils.ts, types.ts, view-model.ts, claims-mapper.ts |
| 2 | StarRating + PdfStarRating + wiring | `04f3820` | StarRating.tsx, PdfStarRating.tsx, PdfStarRating.test.ts, ReportPreview.tsx, ReportPDF.tsx |
| 3 | docx colored Unicode star runs | `53d5539` | ReportDocx.ts, export-docx.test.ts |
| — | Prettier format fixes | `73732f7` | PdfStarRating.tsx, PdfStarRating.test.ts, chart-utils.test.ts, view-model.test.ts |

## Success Criteria — All Met

- [x] 4 rating cells render band-colored star glyphs + number in web preview (StarRating → Tailwind text classes)
- [x] 4 rating cells render band-colored Svg/Path stars in PDF (PdfStarRating → react-pdf primitives)
- [x] 4 rating cells render colored Unicode glyphs in .docx (buildStarRunXml → OOXML <w:r> runs)
- [x] Null/suppressed rating → grey "N/A" with no glyphs in all three renderers (D-06, === null guard)
- [x] PDF stars use react-pdf <Svg>/<Path> — never recharts/DOM — proven by PdfStarRating.test.ts structural test (VIZ-02)
- [x] HospMetricSchema + HospMetric interface + all 4 claims-mapper return paths carry measureKey/source (D-15)
- [x] 12 verbatim CLM-03 metric rows unchanged in all three renderers
- [x] `npm run verify:full` green (typecheck → lint → format:check → test → next build)

## Tests Added

| File | Tests | What They Guard |
|------|-------|-----------------|
| `src/lib/report/star-band.test.ts` | 13 | getStarBand band selection (5 cases), === null strictness, buildStarGlyphs all ratings 1-5 |
| `src/lib/report/chart-utils.test.ts` | 20 | groupByMeasure 12-row/partial/empty inputs; HospMetricSchema closed-enum rejection |
| `src/components/pdf/PdfStarRating.test.ts` | 17 | VIZ-02 structural: Svg/Path for rated; 0 Svg/Path + grey Text for null |
| `tests/api/export-docx.test.ts` (+6) | 6 | Star OOXML: green hex, red hex, ★ glyph, "★★★★★ 5/5", null→grey N/A, T-7-02 tag balance |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] findByType() failed to recurse into array-of-arrays children**
- **Found during:** Task 2 — PdfStarRating.test.ts structural test (star rating 4 case)
- **Issue:** `Array.from({ length: 5 }, ...)` produces `props.children = [array_of_5_Svgs, Text]` where the first child is itself an array. The initial findByType only handled single-element children, missing all Svg nodes.
- **Fix:** Added top-level array guard at the start of findByType: `if (Array.isArray(node)) { iterate and recurse }` — handles any depth of nested arrays.
- **Files modified:** `src/components/pdf/PdfStarRating.test.ts`
- **Commit:** `04f3820`

**2. [Rule 2 - Missing guard] Test assertion "no ☆ in filled XML" was too broad**
- **Found during:** Task 3 — export-docx.test.ts star assertion
- **Issue:** The original test asserted `not.toContain("☆")` on the full document XML, but the Word template itself contains `☆` characters as original unfilled placeholder decoration in some rows, which the fill loop correctly leaves (non-2-`<w:t>` rows).
- **Fix:** Replaced with targeted assertion: `toContain("★★★★★ 5/5")` — verifies the injected run text for a 5-star rating, which is definitive and doesn't depend on the template's original content.
- **Files modified:** `tests/api/export-docx.test.ts`
- **Commit:** `53d5539`

**3. [Rule 2 - Format] Prettier formatting required after Task 2 commits**
- **Found during:** `npm run verify` after Task 2 commit
- **Fix:** Ran `npx prettier --write` on 4 flagged files; committed as separate style commit.
- **Commit:** `73732f7`

## Known Stubs

**NOTE A3 (manual-only, documented in PdfStarRating.tsx):** The `STAR_PATH` 5-point star polygon is reference geometry. Visual verification that it renders as recognizable filled/outline stars in an opened PDF is deferred to Plan 03 SC#4 live smoke test. No test can substitute for visual inspection of the actual rendered PDF star shape.

The docx star rendering is similarly deferred to the Plan 03 SC#4 checklist: open the .docx in LibreOffice and verify colored Unicode glyphs appear in the 4 rating cells.

These are manual-only checks, not functional stubs — the code paths are wired and tested for structural correctness.

## Threat Flags

No new threat surface introduced. T-7-01 and T-7-02 mitigations from the plan's threat register were applied:
- **T-7-01**: `measureKey` and `source` added as `z.enum(["521","522","551","552"])` / `z.enum(["facility","nation","state"])` in HospMetricSchema — closed enums, not free strings.
- **T-7-02**: `buildStarRunXml` interpolates only closed-enum hex strings (from `STAR_BAND_HEX`) and an integer rating — no client free-text. CR-01 callback forms prevent `$`-metachar corruption.

## Self-Check: PASSED

Files verified present:
- `/Users/akashkalita/Infinite-Snapshot/medelite-report/src/lib/report/colors.ts` — FOUND
- `/Users/akashkalita/Infinite-Snapshot/medelite-report/src/lib/report/star-band.ts` — FOUND
- `/Users/akashkalita/Infinite-Snapshot/medelite-report/src/lib/report/chart-utils.ts` — FOUND
- `/Users/akashkalita/Infinite-Snapshot/medelite-report/src/components/StarRating.tsx` — FOUND
- `/Users/akashkalita/Infinite-Snapshot/medelite-report/src/components/pdf/PdfStarRating.tsx` — FOUND
- `/Users/akashkalita/Infinite-Snapshot/medelite-report/src/components/pdf/PdfStarRating.test.ts` — FOUND

Commits verified:
- `17566a7` feat(07-01): D-15 grouping foundation + shared color/band/grouping lib modules — FOUND
- `04f3820` feat(07-01): StarRating (web) + PdfStarRating (PDF) components and their wiring — FOUND
- `53d5539` feat(07-01): docx colored Unicode star runs (full visuals parity) — FOUND
- `73732f7` style(07-01): prettier format Task 2 files — FOUND
