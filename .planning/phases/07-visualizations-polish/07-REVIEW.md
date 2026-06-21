---
phase: 07-visualizations-polish
reviewed: 2026-06-21T00:07:03Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - medelite-report/next.config.ts
  - medelite-report/src/components/MiniBarChart.tsx
  - medelite-report/src/components/pdf/PdfMiniBarChart.tsx
  - medelite-report/src/components/pdf/PdfStarRating.tsx
  - medelite-report/src/components/pdf/ReportPDF.tsx
  - medelite-report/src/components/ReportPreview.tsx
  - medelite-report/src/components/SnapshotApp.tsx
  - medelite-report/src/components/StarRating.tsx
  - medelite-report/src/hooks/useDebounce.ts
  - medelite-report/src/lib/charts/chart-data.ts
  - medelite-report/src/lib/charts/chart-font.ts
  - medelite-report/src/lib/charts/chart-svg.ts
  - medelite-report/src/lib/charts/rasterize.ts
  - medelite-report/src/lib/cms/claims-mapper.ts
  - medelite-report/src/lib/cms/types.ts
  - medelite-report/src/lib/docx/ReportDocx.ts
  - medelite-report/src/lib/report/chart-utils.ts
  - medelite-report/src/lib/report/colors.ts
  - medelite-report/src/lib/report/star-band.ts
  - medelite-report/src/lib/report/view-model.ts
findings:
  critical: 0
  warning: 3
  info: 2
  total: 5
status: issues_found
---

# Phase 7: Code Review Report

**Reviewed:** 2026-06-21T00:07:03Z
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

Phase 7 (visualizations & polish) adds web/PDF/docx bar charts, the star-rating
SVG components, and a debounced manual-input path. The security posture is strong
and was specifically probed for the injection vectors flagged in the prompt:

- **XML/OOXML injection (docx):** All user-controlled text routes through `xmlEsc`
  before injection; star/footer/chart fragments are pre-built from closed enums and
  validated numbers, and every dynamic `.replace()` uses callback form (CR-01),
  verified to keep `$` literal. The `<w:sectPr>` / `{STATE}` literal replacements
  were confirmed against the actual template (`<w:sectPr>` and `{STATE}` each appear
  exactly once; `xmlns:r` is declared so the footer hyperlink `r:id` resolves).
  The TURBOPACK-FOLD-01 single-literal and RESVG-FONT-01 embedded-font constraints
  were respected and are NOT flagged.
- **SVG injection (chart-svg → resvg):** `escSvgAttr`/`escSvgText` escape all
  interpolated values; SVG content derives only from validated `vm.hospMetrics`
  numerics and the closed `CHART_SERIES` palette. No untrusted/remote SVG surface.
- **XSS (web):** All values render via React JSX auto-escaping; no
  `dangerouslySetInnerHTML`/`innerHTML`/`eval`.
- **URL injection (PDF/docx link):** `careCompareUrl` is constrained to
  `https://www.medicare.gov` by `ReportViewModelSchema.refine`.
- **React hooks:** `useDebounce` cleans up its timer on every `[value, delayMs]`
  change; effect deps are complete; `handleSearch` is correctly memoized and manual
  edits never trigger a CMS re-fetch.

No BLOCKER-class defects were found (no injection, data-loss, or crash-on-valid-input
path survived analysis). The findings below are robustness/maintainability concerns.

## Narrative Findings (AI reviewer)

## Warnings

### WR-01: Stale/partial font file is trusted, defeating the RESVG-FONT-01 guarantee

**File:** `medelite-report/src/lib/charts/chart-font.ts:31-42`
**Issue:** `getChartFontFiles()` decides whether to (re)write each embedded TTF using
only `existsSync(path)` against fixed names in the shared OS temp dir
(`infinite-dejavusans.ttf`, `...-bold.ttf`). If a previous invocation crashed
mid-`writeFileSync`, or a concurrent worker/another tenant on the same Lambda warm
instance left a zero-length or truncated file at that exact path, `existsSync`
returns `true` and the corrupt file is handed to resvg with `loadSystemFonts:false`.
The result is the precise failure RESVG-FONT-01 was created to prevent — blank chart
labels in the deployed docx — but now silently and non-reproducibly, because the
"font is present" assumption is satisfied by a bad file. Fixed shared-tmp filenames
also invite cross-process interference.
**Fix:** Validate size (or write atomically) instead of trusting mere existence —
e.g. only skip the write when the on-disk size matches the decoded buffer length,
and write to a temp name then rename:
```ts
import { writeFileSync, existsSync, statSync, renameSync } from "node:fs";

function ensureFont(path: string, b64: string) {
  const buf = Buffer.from(b64, "base64");
  if (existsSync(path) && statSync(path).size === buf.length) return;
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, buf);
  renameSync(tmp, path); // atomic on same filesystem
}
```
Alternatively, pass the font bytes to resvg directly if its API accepts in-memory
font buffers, avoiding the temp-file dependency entirely.

### WR-02: `formatDate` produces "Invalid Date" with no guard, leaking into PDF/docx footer and preview

**File:** `medelite-report/src/lib/report/format.ts:70-78` (consumed at
`ReportPDF.tsx:331`, `ReportPreview.tsx:247`, `ReportDocx.ts:304`)
**Issue:** `formatDate` does `new Date(value)` on `f.processingDate`, which is only
`z.string()` (no date-format constraint). If CMS returns an unparseable
`processing_date` (format drift, empty string), `toLocaleDateString` yields the
literal string `"Invalid Date"`, which is then rendered verbatim in the Phase-7
footer of all three outputs ("CMS dataset processing date: Invalid Date"). This is a
visible quality regression in a shipped artifact rather than a clean fallback.
**Fix:** Guard for an invalid date and fall back to the raw/placeholder value:
```ts
export function formatDate(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return typeof value === "string" ? value : PLACEHOLDER;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}
```

### WR-03: `svgToPngBuffer` silently ignores its `height` argument

**File:** `medelite-report/src/lib/charts/rasterize.ts:30-49`
**Issue:** The `height` parameter is declared (and eslint-disabled as unused) but
resvg is configured with `fitTo: { mode: "width", value: width }`, so the requested
height is never honored — output height is whatever preserves the SVG's intrinsic
aspect ratio. Callers in `ReportDocx.ts:405` pass `RASTER_H_PX` (560) under the
reasonable assumption it controls the raster, and the EMU box (`CHART_EMU_H`) is
computed from the logical 140px height. If `renderChartSvgString`'s SVG aspect ratio
ever diverges from `RASTER_W:RASTER_H` (e.g. a future title-height tweak), the PNG's
true height will mismatch the declared EMU `cy`, distorting the chart in Word with no
error. The dead parameter hides this coupling.
**Fix:** Either drop the parameter to make the width-only scaling explicit, or honor
it by deriving aspect-correct extents from the actual rendered PNG dimensions
(`pngData.width`/`pngData.height`) when building `CHART_EMU_H`, instead of assuming
the logical ratio holds.

## Info

### IN-01: Index-based React keys on chart bar/tick lists

**File:** `medelite-report/src/components/pdf/PdfMiniBarChart.tsx:71,179,199,228`,
`medelite-report/src/components/MiniBarChart.tsx:72`
**Issue:** Several lists key on the array index (`key={i}`) or on a tick value
(`key={v}`). The data here is static per render and order-stable, so this is benign
today (verified: tick values never collide because `yMax >= 1`). Flagged only as a
consistency note — `ReportPreview.tsx:208` already keys metric rows by
`metric.label`, which is the preferred stable-identity pattern.
**Fix:** Where a stable identity exists (e.g. `d.name` for the 3 series), prefer it
over the array index for clarity and future-proofing.

### IN-02: Tooltip `formatter` typed narrower than recharts' contract

**File:** `medelite-report/src/components/MiniBarChart.tsx:57-58`
**Issue:** `formatter = (v: number) => ...` is narrower than recharts' `Formatter`
signature (`value: ValueType = string | number`). It is correct in practice because
the `value` dataKey is always numeric from `buildChartData`, so the runtime value is
always a `number` — no actual defect. Noted only because the explicit `number`
annotation hides the wider library contract.
**Fix:** None required; if desired, accept `number | string` and coerce, or rely on
the inferred recharts type.

---

_Reviewed: 2026-06-21T00:07:03Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
