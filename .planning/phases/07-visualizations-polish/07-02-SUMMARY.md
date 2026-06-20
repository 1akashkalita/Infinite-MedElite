---
phase: "07"
plan: "02"
subsystem: "visualizations"
tags: ["charts", "svg", "pdf", "docx", "recharts", "resvg"]
dependency_graph:
  requires: ["07-01"]
  provides: ["mini-bar-charts-web", "mini-bar-charts-pdf", "chart-pngs-docx"]
  affects: ["ReportPreview", "ReportPDF", "ReportDocx"]
tech_stack:
  added:
    - "@resvg/resvg-js@^2.6.2 (NAPI SVG→PNG rasterizer)"
  patterns:
    - "chart-data.ts (shared) vs chart-svg.ts (server-only) module split to avoid Turbopack client boundary violations"
    - "hand-crafted SVG builder (no recharts server-side) for docx PNG generation"
    - "native react-pdf SVG primitives for PDF charts (avoids recharts optimizePackageImports conflict)"
    - "Text labels outside <Svg> in PDF charts to avoid SVG CID font encoding collision (CLM-03 guard)"
key_files:
  created:
    - medelite-report/src/lib/charts/chart-data.ts
    - medelite-report/src/lib/charts/chart-svg.ts
    - medelite-report/src/lib/charts/chart-svg.test.ts
    - medelite-report/src/lib/charts/rasterize.ts
    - medelite-report/tests/lib/charts/rasterize.test.ts
    - medelite-report/src/components/MiniBarChart.tsx
    - medelite-report/src/components/pdf/PdfMiniBarChart.tsx
    - medelite-report/src/components/pdf/PdfMiniBarChart.test.ts
  modified:
    - medelite-report/next.config.ts (added @resvg/resvg-js to serverExternalPackages)
    - medelite-report/package.json (added @resvg/resvg-js dependency)
    - medelite-report/src/components/ReportPreview.tsx (chart section below table)
    - medelite-report/src/components/pdf/ReportPDF.tsx (PdfMiniBarChart below table)
    - medelite-report/src/lib/docx/ReportDocx.ts (step 10: chart PNG embedding)
    - medelite-report/tests/api/export-docx.test.ts (chart PNG + rels assertions)
decisions:
  - "Replaced recharts+react-dom/server in renderChartSvgString with a hand-crafted SVG builder — recharts is in Next.js default optimizePackageImports (auto-added to transpilePackages), conflicting with serverExternalPackages; react-dom/server is statically blocked by Turbopack in Route Handler bundles"
  - "Replaced react-pdf-charts+recharts in PdfMiniBarChart with native react-pdf SVG primitives — same recharts bundling issue affects the PDF route"
  - "Kept Text labels OUTSIDE <Svg> in PdfMiniBarChart — react-pdf Text inside Svg uses SVG CID glyph encoding which causes font table collisions preventing CLM-03 text extraction"
  - "Split chart-svg.ts into chart-data.ts (shared, client-safe) + chart-svg.ts (server-only) to allow MiniBarChart.tsx (use client) to import buildChartData without pulling in server-only code"
metrics:
  duration: "~90 minutes"
  completed: "2026-06-20T21:47:27Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 8
  files_modified: 7
---

# Phase 07 Plan 02: Mini Bar Charts (Web + PDF + .docx) Summary

Mini grouped-bar charts (facility/national/state series) wired across all three renderers — web preview, PDF export, and .docx export — with @resvg/resvg-js SVG→PNG rasterization for the docx path.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install @resvg/resvg-js + chart-svg/rasterize server libs | `9b43e4a` | chart-data.ts, chart-svg.ts, rasterize.ts, chart-svg.test.ts, rasterize.test.ts, next.config.ts, package.json |
| 2 | MiniBarChart (web) + PdfMiniBarChart (PDF) with chart wiring | `80a44ab` | MiniBarChart.tsx, PdfMiniBarChart.tsx, PdfMiniBarChart.test.ts, ReportPreview.tsx, ReportPDF.tsx |
| 3 | docx chart PNG embedding + build compatibility fixes | `ec1ceea` | chart-data.ts (new), chart-svg.ts (rewritten), PdfMiniBarChart.tsx (rewritten), PdfMiniBarChart.test.ts (rewritten), ReportDocx.ts, export-docx.test.ts, MiniBarChart.tsx |

## What Was Built

### Web (MiniBarChart.tsx)
- recharts v2 `<ResponsiveContainer><BarChart>` with D-07 series (facility=blue, national=green, state=amber)
- D-08 `<Legend>` mandatory so readers know green = National series identity, NOT "good" performance
- D-09: all-suppressed → "N/A" span; partial → only non-null bars rendered
- Imported from `chart-data.ts` (client-safe, no server imports)

### PDF (PdfMiniBarChart.tsx)
- Native react-pdf SVG primitives: `<Svg><Rect><Line><G>` for bars and axis geometry
- Series name legend uses react-pdf `<Text>` elements OUTSIDE `<Svg>` (CLM-03 guard)
- D-09: all-suppressed → `<Text>N/A</Text>` with no empty chart frame
- No recharts dependency (avoids Turbopack bundling conflict)

### Docx (ReportDocx.ts step 10)
- 4 chart PNGs embedded via `groupByMeasure → buildChartData → renderChartSvgString → svgToPngBuffer`
- Hand-crafted SVG builder (no recharts) → @resvg/resvg-js rasterization
- OOXML `<w:drawing>` paragraphs injected before `<w:sectPr>` (CR-01 callback form)
- Image relationships added to `word/_rels/document.xml.rels`
- Guards: skip all-suppressed groups (D-09), guard against pre-existing rId conflicts

### Shared Infrastructure
- `chart-data.ts`: `ChartDatum` type + `buildChartData()` (shared, no server imports)
- `chart-svg.ts`: re-exports from chart-data.ts + `renderChartSvgString()` (server-only, hand-crafted SVG)
- `rasterize.ts`: `svgToPngBuffer()` via @resvg/resvg-js (NAPI binary, serverExternalPackages)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Turbopack blocks react-dom/server as static top-level import**
- **Found during:** Task 3 build attempt
- **Issue:** `chart-svg.ts` had `import { renderToStaticMarkup } from "react-dom/server"` at the top level. Turbopack refuses this even in Route Handler server bundles.
- **Fix:** Replaced `renderToStaticMarkup(recharts elements)` with a hand-crafted SVG builder — no react-dom/server needed.
- **Files modified:** `src/lib/charts/chart-svg.ts`
- **Commit:** `ec1ceea`

**2. [Rule 3 - Blocking] recharts class components break in server bundle ("Super expression" error)**
- **Found during:** Task 3 build attempt
- **Issue:** recharts v2 React class components fail at runtime in the server bundle. Adding recharts to `serverExternalPackages` conflicts with Next.js's default `optimizePackageImports` list which auto-adds recharts to `transpilePackages`.
- **Fix for docx route:** Hand-crafted SVG builder in chart-svg.ts (no recharts server-side).
- **Fix for PDF route:** Replaced react-pdf-charts+recharts in PdfMiniBarChart with native react-pdf SVG primitives (Svg/Rect/Line/G for bars; View/Text outside Svg for legend).
- **Files modified:** `src/components/pdf/PdfMiniBarChart.tsx`, `src/lib/charts/chart-svg.ts`
- **Commit:** `ec1ceea`

**3. [Rule 1 - Bug] react-pdf Text inside Svg causes CLM-03 test regression**
- **Found during:** Task 3 testing (after initial native SVG implementation)
- **Issue:** First version of PdfMiniBarChart used `<Text>` elements inside `<Svg>`. react-pdf renders SVG Text with a separate CID glyph font encoding. This created a font table collision that prevented `extractTextFromPdf` from decoding the metric label text (CLM-03 tests failed: extracted only chart text, not table content).
- **Fix:** Moved all text labels (legend series names) OUTSIDE the `<Svg>` element, using react-pdf `<View><Text>` in the flexbox layout below the chart.
- **Files modified:** `src/components/pdf/PdfMiniBarChart.tsx`, `src/components/pdf/PdfMiniBarChart.test.ts`
- **Commit:** `ec1ceea`

**4. [Rule 3 - Blocking] MiniBarChart (use client) transitively imported chart-svg.ts (server-only)**
- **Found during:** Task 3 build attempt
- **Issue:** `chart-svg.ts` contained both `buildChartData` (safe for client) and `renderChartSvgString` (server-only, imports react-dom/server). `MiniBarChart.tsx` imported `buildChartData` from `chart-svg.ts`, causing Turbopack to flag the server-only import in the client bundle.
- **Fix:** Split into `chart-data.ts` (shared, client-safe) and `chart-svg.ts` (server-only). MiniBarChart now imports from `chart-data.ts`.
- **Files created:** `src/lib/charts/chart-data.ts`
- **Commit:** `ec1ceea`

**5. [Rule 1 - Bug] recharts renderToStaticMarkup output wraps SVG in div**
- **Found during:** Task 1-3 (prior session)
- **Issue:** recharts' `renderToStaticMarkup` produces `<div class="recharts-wrapper">...<svg>...</svg></div>`. @resvg/resvg-js requires an `<svg>` root element.
- **Fix:** Extract inner `<svg>` using regex + add `xmlns` attribute. (Moot after deviation 1/2 removed recharts from server path, but was fixed first.)
- **Files modified:** `src/lib/charts/chart-svg.ts`
- **Commit:** `ec1ceea`

## Test Coverage Added

| File | Tests | What it guards |
|------|-------|---------------|
| src/lib/charts/chart-svg.test.ts | 13 | buildChartData D-09 filtering + renderChartSvgString SVG smoke test |
| tests/lib/charts/rasterize.test.ts | 9 | svgToPngBuffer PNG magic bytes (0x89504E47) |
| src/components/pdf/PdfMiniBarChart.test.ts | 15 | Svg present, Rect bars, D-08 legend text, D-09 N/A path, CLM-03 no-Text-in-Svg guard |
| tests/api/export-docx.test.ts | +5 | chart PNGs in zip, PNG magic bytes, rIdChart rels, degraded path, DOCX-01 size with PNGs |

## Known Stubs

None — all chart data is wired to real vm.hospMetrics values (D-09 suppression handled). The hand-crafted SVG bar chart is simpler than recharts (no value labels on bars, no animated tooltip) but is intentionally minimal for the docx rasterization path.

## Threat Flags

None — chart SVG is generated purely from validated numeric values and closed-enum CHART_SERIES colors. No user-controlled strings reach the SVG or OOXML injection paths (T-7-04 compliant). Chart PNG bytes are stored in word/media/ without XML injection (binary attachment, not XML text).

## Self-Check: PASSED

- chart-data.ts: FOUND at medelite-report/src/lib/charts/chart-data.ts
- chart-svg.ts: FOUND at medelite-report/src/lib/charts/chart-svg.ts
- rasterize.ts: FOUND at medelite-report/src/lib/charts/rasterize.ts
- MiniBarChart.tsx: FOUND at medelite-report/src/components/MiniBarChart.tsx
- PdfMiniBarChart.tsx: FOUND at medelite-report/src/components/pdf/PdfMiniBarChart.tsx
- Commits verified: 9b43e4a, 80a44ab, ec1ceea present in git log
- npm run verify: PASSED (377 tests + 1 skipped)
- npm run build: PASSED (all routes compiled successfully)
