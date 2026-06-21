---
phase: 07-visualizations-polish
plan: 03
subsystem: ui
tags: [react, hooks, debounce, react-pdf, docx, resvg, turbopack, vercel]

requires:
  - phase: 07-01
    provides: star ratings + groupByMeasure/colors foundation (verified in live SC#4)
  - phase: 07-02
    provides: claims-metric charts (web/PDF/docx) verified + fixed live in this plan
provides:
  - useDebounce(value, delayMs) hook + SnapshotApp wiring (manual edits → debounced vm, no CMS re-fetch)
  - Live-Vercel SC#4 smoke pass on the real deployed URL with real downloaded PDF + .docx artifacts
  - Chart legend removed across all 3 renderers; PDF + .docx charts in a 2×2 grid matching the web preview
  - docx chart label font +1.5pt; docx "Quality of Resident Care" star row aligned
  - Two production-only docx bug fixes (Turbopack XML folding; @resvg Lambda fonts)
affects: [future-phases, deployment, docx-export, pdf-export]

tech-stack:
  added: [embedded DejaVu Sans subset (base64) for @resvg]
  patterns:
    - "OOXML fragments built as SINGLE template literals (TURBOPACK-FOLD-01) — never +-chained literals"
    - "@resvg given an embedded font + loadSystemFonts:false so SVG text renders on Lambda (RESVG-FONT-01)"
    - "Verify docx/PDF against a real next build + next start, not just vitest"

key-files:
  created:
    - medelite-report/src/hooks/useDebounce.ts
    - medelite-report/src/hooks/useDebounce.test.ts
    - medelite-report/src/lib/charts/chart-font.ts
  modified:
    - medelite-report/src/components/SnapshotApp.tsx
    - medelite-report/src/components/MiniBarChart.tsx
    - medelite-report/src/components/pdf/PdfMiniBarChart.tsx
    - medelite-report/src/components/pdf/ReportPDF.tsx
    - medelite-report/src/lib/charts/chart-svg.ts
    - medelite-report/src/lib/charts/rasterize.ts
    - medelite-report/src/lib/docx/ReportDocx.ts

key-decisions:
  - "Removed the chart legend in all 3 renderers; X-axis Facility/National/State labels carry series identity (supersedes D-08 legend-required)"
  - "PDF charts use react-pdf native SVG primitives (not react-pdf-charts) to avoid a Next.js bundling conflict — still compliant with the PDF-renderer rule"
  - "docx charts arranged in a real <w:tbl> 2×2 grid (tblGrid + fixed layout, DOCX-GRID-01); raster at 2× for sharpness"
  - "Build OOXML as single template literals (TURBOPACK-FOLD-01); embed a font for @resvg (RESVG-FONT-01)"

patterns-established:
  - "TURBOPACK-FOLD-01: never +-chain OOXML string literals (prod minifier drops fragments)"
  - "RESVG-FONT-01: embed font + loadSystemFonts:false for serverless SVG rasterization"

requirements-completed: [VIZ-01, VIZ-02]

duration: ~3h (incl. live debugging of two production-only bugs)
completed: 2026-06-20
---

# Phase 07 Plan 03: Live-Preview Debounce + Live-Vercel Polish Summary

**300ms manual-input debounce (no CMS re-fetch) plus a full live-Vercel SC#4 pass that uncovered and fixed two production-only docx bugs (Turbopack XML mangling + @resvg Lambda fonts).**

## Performance
- **Duration:** ~3h (debounce was quick; most time was live SC#4 debugging)
- **Completed:** 2026-06-20
- **Tasks:** 3 (Task 1 auto; Tasks 2 & 3 human-verify checkpoints, both approved)
- **Files modified:** 10

## Accomplishments
- `useDebounce(value, delayMs)` hook + SnapshotApp wiring: manual-input edits update the preview ~300ms after typing stops; the same debounced vm drives both the preview and ExportControls; `handleSearch` (the only CMS fetch) is untouched — no re-fetch on manual edits (SC#3 / D-14).
- Live SC#4 smoke on the deployed URL with real downloaded artifacts: 8/10 checklist items verified live (items 1 leading-zero CCN and 3 N/A suppression code-verified, pending specific test CCNs).
- Visual polish (user feedback): removed the black "Value" legend in all 3 renderers; PDF + docx charts now render in a 2×2 grid with titles + Y/X axis labels matching the web preview; docx chart label font +1.5pt; docx footer moved after the charts; "Quality of Resident Care" docx star row aligned.

## Task Commits
1. **Task 1: useDebounce hook + SnapshotApp wiring** — `9efaaf2` (feat)
2. **Visual fix: remove legend + add titles/axis labels** — `59378ab` (fix)
3. **Visual fix: 2×2 PDF chart grid** — `3ef640c` (fix)
4. **Visual fix: 2×2 docx grid + raster + footer order + star align** — `8cf9b87` (fix)
5. **Visual fix: docx chart label font +1.5pt** — `6e839d9` (fix)
6. **Prod fix: Turbopack docx XML corruption (single template literals)** — `ea80215` (fix)
7. **Prod fix: embed @resvg font for Lambda chart labels** — `9e04285` (fix)

## Files Created/Modified
- `src/hooks/useDebounce.ts` (+test) — generic debounce hook (explicit setTimeout/clearTimeout)
- `src/components/SnapshotApp.tsx` — debounced vm assembly; handleSearch untouched
- `src/components/MiniBarChart.tsx` — removed `<Legend>` (web)
- `src/components/pdf/PdfMiniBarChart.tsx` — title + Y/X axis labels, legend removed
- `src/components/pdf/ReportPDF.tsx` — 2×2 chart grid
- `src/lib/charts/chart-svg.ts` — title param, legend removed, label fonts +1.5pt
- `src/lib/charts/rasterize.ts` — embedded font + loadSystemFonts:false
- `src/lib/charts/chart-font.ts` (new) — base64 DejaVu Sans subset for @resvg
- `src/lib/docx/ReportDocx.ts` — 2×2 table, footer-after-charts, star alignment, single-template-literal XML

## Decisions Made
See key-decisions frontmatter. Notably the legend removal supersedes the original D-08 "legend required" decision (X-axis labels now convey series identity), per direct user feedback.

## Deviations from Plan
The plan scoped Task 1 (debounce) + a live smoke. The live smoke (Task 3) surfaced real defects that were fixed in-flight rather than deferred:
- Visual feedback from the user (legend, 2×2 grids, star alignment, font size) — fixed across 07-01/07-02 deliverables.
- **Two production-only bugs** invisible to vitest, found by downloading live artifacts:
  - **Turbopack** mis-folded `+`-chained OOXML string literals → malformed `document.xml` (Word wouldn't open it). Fixed by single template literals (`ea80215`).
  - **@resvg** had no fonts on Vercel Lambda → blank chart labels. Fixed by embedding a DejaVu Sans subset + `loadSystemFonts:false` (`9e04285`).
Both fixes verified against a local production build AND the live deployment.

## Issues Encountered
- Live URL changed: repo rename to `Infinite-MedElite` renamed the Vercel project; production is now `https://infinite-medelite.vercel.app` (old `infinite-snapshot.vercel.app` is dead). User opted to manage Vercel aliases themselves.
- SSH push blocked in this environment; pushed over HTTPS via the `gh` token credential helper.

## Next Phase Readiness
- Phase 7 visual upgrades are live and verified on the deployed URL. `npm run verify:full` green.
- Open follow-ups (non-blocking): live-test leading-zero CCN (item 1) and a null-rating facility (item 3); consider updating in-repo docs that still reference the old Vercel URL.

---
*Phase: 07-visualizations-polish*
*Completed: 2026-06-20*
