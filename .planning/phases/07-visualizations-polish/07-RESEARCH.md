# Phase 7: Visualizations & Polish - Research

**Researched:** 2026-06-20
**Domain:** React charting (recharts v2 + react-pdf-charts), @react-pdf/renderer SVG primitives, SVG→PNG rasterization for docx, React 19 useDeferredValue debounce, Vercel serverless binary constraints
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Replace in-table, do NOT add a separate visuals band. Visuals upgrade the value cells of the existing bordered template table; labels, row order, and overall table structure stay template-exact.
- **D-02:** Stars replace the rating value cells (glyph + number, not numbers alone).
- **D-03:** Metrics — keep all 12 verbatim rows AND add charts below them; charts never replace rows. CLM-03 intact.
- **D-04:** Each rating value cell shows glyphs + number — `★★★★☆ 4/5`. Accessibility: numeric always visible.
- **D-05:** Color-coded by band: green 4–5 / amber 3 / red 1–2.
- **D-06:** Null/suppressed rating → locked `"N/A"` string in neutral grey, NO glyphs. No 5-grey-outline rendering.
- **D-07:** Four mini grouped-bar charts (one per measure), 3 bars each: facility / national / state.
- **D-08:** Bar hues — facility = blue, national = green, state = amber. MUST carry a legend (green "national" ≠ green "good" performance band).
- **D-09:** Suppressed bar → omit bar + "N/A" tick. 12 rows still carry CLM-02 message. Partially-suppressed measure still renders chart with available bars.
- **D-10:** PDF gets full visuals via react-pdf SVG primitives (stars) + react-pdf-charts (metric charts). NEVER recharts/DOM in PDF.
- **D-11:** `.docx` gets Unicode star glyphs in colored `TextRun`s + four chart PNGs as `ImageRun`. Server-side rasterization required.
- **D-12:** Built-in fonts only (Helvetica for PDF, docx default). No custom font registration.
- **D-13:** Do NOT register a custom brand font this phase.
- **D-14:** 300ms debounce on manual-input → preview/view-model path. Manual edits NEVER trigger CMS re-fetch. Mechanism is Claude's discretion.
- **D-15:** Prefer EXPLICIT grouping of 12 flat metrics into 4 measures × {facility, national, state} via `measureKey`/`source` on `HospMetric` or view-model extension. Positional chunk-by-3 is a fallback.

### Claude's Discretion

- Exact glyph implementation per renderer (web Unicode/SVG; PDF `<Svg>` path geometry; docx Unicode colored runs) and shared color constants.
- Chart sizing, axis/label styling, legend placement, and exactly where below the 12 rows the four charts sit (grid vs stacked).
- Debounce mechanism (D-14) — `useDeferredValue` vs explicit timer/`useDebounce` hook.
- The chart-to-image library choice for the `.docx` (D-11), subject to Vercel-runtime + 4.5 MB constraints.
- Whether star/chart rendering is factored into shared sub-components.

### Deferred Ideas (OUT OF SCOPE)

- BENCH-01/BENCH-02: Benchmark verdict visuals, better/worse flag — explicitly v2.
- Registered custom/brand font — D-13 locks this out for Phase 7.
- Shared cross-renderer row/visual descriptor refactor.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VIZ-01 | Star ratings and key metrics render as polished visual cards/charts in the web UI | Web: Unicode stars + Tailwind color + recharts BarChart grouped bars; see §Standard Stack, §Architecture Patterns |
| VIZ-02 | Visual elements render correctly inside the PDF using react-pdf SVG primitives / react-pdf-charts (never DOM-based charting) | react-pdf-charts v1.0.0 confirmed installed; SVG star geometry pattern documented; isAnimationActive={false} required; see §Common Pitfalls |

</phase_requirements>

---

## Summary

Phase 7 is a pure rendering enhancement phase — all data acquisition is complete (Phases 1–6 green). The work splits across three renderers (web/PDF/docx) and a debounce seam.

**Star ratings** are straightforward in all three renderers: web uses Unicode `★`/`☆` with Tailwind color classes; PDF uses `@react-pdf/renderer` `<Svg><Path>` with a polar-coordinate 5-point star path; docx uses Unicode `TextRun`s with OOXML `<w:color>` matching the band palette. No external star-glyph library is needed or warranted.

**Metric charts** require careful renderer selection. For the web, recharts v2 `<BarChart>` with three `<Bar>` series works cleanly as a client component. For the PDF, `react-pdf-charts@1.0.0` is already installed and calls `renderToStaticMarkup()` on the recharts tree, then converts the resulting SVG string to react-pdf `<Svg>` primitives — this is the documented and confirmed approach, and it requires `isAnimationActive={false}` on every `<Bar>` (and any other animated child). For the docx, the only reliable approach that works on Vercel serverless without native-binary risks is **`@resvg/resvg-js`** (`@2.6.2`), which ships pre-built NAPI binaries including `@resvg/resvg-js-linux-x64-gnu` (the Vercel Lambda platform). It needs to be added to `serverExternalPackages`.

**The debounce** is best implemented as an explicit `useDebounce` hook (a 5-line `setTimeout`/`clearTimeout` wrapper) over React 19's `useDeferredValue`, because `useDeferredValue` has no guaranteed delay — it defers to the next render cycle, which may be sub-millisecond in fast React 19 concurrent renders. A fixed 300ms timer is the reliable approach for the specified latency requirement.

**Primary recommendation:** Use `@resvg/resvg-js` for SVG→PNG rasterization in the docx route; add it to `serverExternalPackages`. Implement debounce as an explicit 300ms timer hook in `SnapshotApp`. Build PDF charts with `react-pdf-charts` wrapping recharts v2 with `isAnimationActive={false}`. Open the actual downloaded PDF and docx to verify charts render — never trust the web preview alone.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Star glyphs (web) | Browser / Client | — | `ReportPreview` is `"use client"`; Unicode + Tailwind classes are DOM-only |
| Star glyphs (PDF) | API / Backend (route handler) | — | `ReportPDF` is server-only; uses react-pdf `<Svg><Path>` |
| Star glyphs (docx) | API / Backend (route handler) | — | `buildReportDocxBuffer` is server-only; injects OOXML colored `<w:t>` runs via JSZip |
| Metric bar charts (web) | Browser / Client | — | recharts `<BarChart>` is a client-side React component; lives in `ReportPreview` |
| Metric bar charts (PDF) | API / Backend (route handler) | — | react-pdf-charts wrapper around recharts runs server-side via `renderToStaticMarkup`; lives in `ReportPDF` |
| Metric bar charts (docx) | API / Backend (route handler) | — | SVG→PNG rasterization (`@resvg/resvg-js`) runs in the docx route handler |
| 300ms debounce | Browser / Client | — | Lives in `SnapshotApp` (client component) between `ManualInputsForm.onChange` and `vm` assembly |
| D-15 metric grouping | API / Backend or shared lib | — | `METRIC_DEFINITIONS` in `claims-mapper.ts`; best surfaced as `measureKey`/`source` on `HospMetric` or view-model, then consumed by all three renderers |

---

## Standard Stack

### Core (already installed — no new installs for most of Phase 7)

| Library | Installed Version | Purpose | Why Standard |
|---------|------------------|---------|--------------|
| `recharts` | `^2.15.4` (pinned v2) | Grouped bar charts in the web UI (client components) | v2 is the ONLY version compatible with react-pdf-charts; v3 is explicitly broken |
| `react-pdf-charts` | `^1.0.0` | Adapter: renders recharts v2 into react-pdf SVG primitives for the PDF | The only documented approach for charts inside @react-pdf/renderer |
| `@react-pdf/renderer` | `^4.5.1` | PDF generation; `<Svg>/<Path>/<Rect>/<G>` primitives for star glyphs | Already in use; SVG primitives are the correct tool for star geometries |
| `docx` | `^9.7.1` | Template-fill docx builder (via JSZip) for star `TextRun`s + `ImageRun` chart PNGs | Already in use; `IImageOptions` supports `type: "png"` with `Buffer` data |

### New Package Required: SVG→PNG Rasterization

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@resvg/resvg-js` | `^2.6.2` | Server-side SVG string → PNG `Buffer` for docx `ImageRun` | Pre-built NAPI binaries for linux-x64-gnu (Vercel Lambda); pure Rust, no system librsvg dependency; playground deployed on Vercel at resvg-js.vercel.app |

**Installation (from `medelite-report/`):**
```bash
npm install @resvg/resvg-js@^2.6.2
```

**`next.config.ts` addition required:**
```ts
serverExternalPackages: ["@react-pdf/renderer", "@resvg/resvg-js"],
```
`@resvg/resvg-js` is NOT in Next.js's auto-external list (verified: only `@react-pdf/renderer`, `canvas`, and `sharp` appear in `server-external-packages.jsonc`). It must be explicitly listed or it will fail to load its NAPI `.node` binary at runtime.

### Supporting (already installed)

| Library | Installed Version | Purpose | When to Use |
|---------|------------------|---------|-------------|
| `zod` | `^4.4.3` | Validate any chart data shape changes to `HospMetricSchema`/`ReportViewModelSchema` | D-15: if `measureKey`/`source` are added to `HospMetricSchema`, extend the schema |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@resvg/resvg-js` | `sharp` | `sharp` IS in Next.js auto-external list, but its SVG input requires `librsvg` — a native C library NOT present in Vercel's Lambda container. `sharp` SVG→PNG fails silently on Vercel without `librsvg`. |
| `@resvg/resvg-js` | `@resvg/resvg-wasm` | WASM variant requires no native binary (works everywhere) but is ~3–5× slower; acceptable for 4 small charts but adds WASM bundle size to the route handler |
| `@resvg/resvg-js` | `canvas` (node-canvas) | `canvas` IS in Next.js auto-external list but requires system libcairo/libpango — also absent in Vercel Lambda. Confirmed broken pattern per PITFALLS #6 Recovery table. |
| `react-pdf-charts` for stars | Manual `<Svg><Path>` SVG star | Stars are 5-point geometry, NOT complex recharts output — manual SVG path is simpler, smaller, more precise. Use react-pdf-charts ONLY for the bar charts. |
| Explicit `useDebounce` timer | `useDeferredValue` | `useDeferredValue` has no guaranteed minimum delay in React 19 concurrent mode. Appropriate for deprioritizing expensive renders, not for a precise 300ms UX requirement. |

---

## Package Legitimacy Audit

> slopcheck was not installable in this session (auto-mode permission denial). All packages below are tagged `[ASSUMED]` for the new package and `[VERIFIED]` for existing ones. The planner must add a `checkpoint:human-verify` for the `@resvg/resvg-js` install.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `recharts@2.15.4` | npm | ~9 yrs | >5M/wk | github.com/recharts/recharts | unavailable | Approved [VERIFIED: already installed, pinned per STACK.md] |
| `react-pdf-charts@1.0.0` | npm | ~3 yrs | moderate | github.com/EvHaus/react-pdf-charts | unavailable | Approved [VERIFIED: already installed, README confirmed] |
| `@react-pdf/renderer@4.5.1` | npm | ~8 yrs | >1M/wk | github.com/diegomura/react-pdf | unavailable | Approved [VERIFIED: already installed] |
| `docx@9.7.1` | npm | ~7 yrs | >1M/wk | github.com/dolanmiu/docx | unavailable | Approved [VERIFIED: already installed] |
| `@resvg/resvg-js@2.6.2` | npm | ~3 yrs (2021-10-09) | moderate | github.com/yisibl/resvg-js | unavailable | [ASSUMED] — planner must add `checkpoint:human-verify` before install |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck unavailable)
**Packages flagged as suspicious [SUS]:** none identified by manual check

*slopcheck was unavailable at research time. `@resvg/resvg-js` is tagged `[ASSUMED]` — planner must gate its install behind a `checkpoint:human-verify` task. The other four packages are already installed and in use (no gate needed).*

---

## Architecture Patterns

### System Architecture Diagram

```
ManualInputsForm.onChange
        │
        ▼ (300ms debounce)
SnapshotApp: assembleViewModel()
        │
        ├──────────────────────────────────────┐
        ▼                                      ▼
ReportPreview (client)              ExportControls (client)
  ├── StarGlyphs (Unicode/Tailwind)       │
  └── MiniBarChart × 4 (recharts v2)     ├── POST /api/export/pdf
                                         │     └── ReportPDF (server)
                                         │           ├── PdfStarGlyphs (<Svg><Path>)
                                         │           └── PdfBarChart × 4
                                         │                 (ReactPDFChart wrapping recharts)
                                         │
                                         └── POST /api/export/docx
                                               └── buildReportDocxBuffer() (server)
                                                     ├── Unicode star TextRuns (OOXML)
                                                     └── chartPng × 4
                                                           (recharts SVG → @resvg/resvg-js → PNG Buffer → ImageRun)
```

**Key invariant:** The `vm` assembled in `SnapshotApp` drives ALL three outputs. The debounced `vm` value feeds both `ReportPreview` and `ExportControls` so preview and export stay consistent.

### D-15: Metric Grouping — Recommended Extension

The 12 `hospMetrics` rows in `vm` are already in fixed order (4 measures × facility/national/state). For chart grouping, **extend `HospMetric` with `measureKey` and `source`** — these already exist in `METRIC_DEFINITIONS` in `claims-mapper.ts`:

```typescript
// types.ts — add to HospMetric
export interface HospMetric {
  label: string;
  value: number | null;
  unit: "percent" | "rate";
  footnoteCode?: string;
  // Phase 7 chart grouping keys (D-15)
  measureKey: "521" | "522" | "551" | "552";
  source: "facility" | "nation" | "state";
}
```

Update `HospMetricSchema` in `view-model.ts` to add `measureKey: z.enum(["521","522","551","552"])` and `source: z.enum(["facility","nation","state"])`. Update `joinClaimsAndAverages` in `claims-mapper.ts` to populate these fields from `METRIC_DEFINITIONS`. Then group `vm.hospMetrics` into 4 measure buckets at render time:

```typescript
// Utility: group 12 flat metrics into 4 measure groups
function groupByMeasure(metrics: HospMetric[]) {
  const groups: Record<string, { facility?: HospMetric; nation?: HospMetric; state?: HospMetric }> = {};
  for (const m of metrics) {
    if (!groups[m.measureKey]) groups[m.measureKey] = {};
    groups[m.measureKey][m.source] = m;
  }
  return ["521", "522", "551", "552"].map((k) => groups[k]);
}
```

The fallback (positional chunk-by-3) works because the 12 rows are in fixed order but is fragile if CMS ever returns partial rows — explicit keys are safer.

### Recommended Project Structure (additions only)

```
src/
├── components/
│   ├── StarRating.tsx           # Web: Unicode stars + Tailwind color bands
│   ├── MiniBarChart.tsx         # Web: recharts BarChart grouped for one measure
│   ├── ReportPreview.tsx        # MODIFIED: import StarRating + MiniBarChart below table
│   └── pdf/
│       ├── PdfStarRating.tsx    # PDF: react-pdf <Svg><Path> 5-point star geometry
│       ├── PdfMiniBarChart.tsx  # PDF: ReactPDFChart wrapping recharts BarChart
│       └── ReportPDF.tsx        # MODIFIED: import PdfStarRating + PdfMiniBarChart
├── lib/
│   ├── cms/
│   │   ├── types.ts             # MODIFIED: add measureKey/source to HospMetric (D-15)
│   │   └── claims-mapper.ts     # MODIFIED: populate measureKey/source in METRIC_DEFINITIONS map
│   ├── report/
│   │   └── view-model.ts        # MODIFIED: extend HospMetricSchema with measureKey/source
│   ├── docx/
│   │   └── ReportDocx.ts        # MODIFIED: inject Unicode star runs + ImageRun chart PNGs
│   └── charts/
│       └── rasterize.ts         # NEW: SVG string → PNG Buffer via @resvg/resvg-js
```

### Pattern 1: Web Star Rating Cell (Unicode + Tailwind)

```tsx
// src/components/StarRating.tsx — "use client"
// Source: D-04/D-05/D-06 decisions
const BAND_COLORS: Record<string, string> = {
  green: "text-green-600",   // 4-5 stars
  amber: "text-amber-500",   // 3 stars
  red:   "text-red-600",     // 1-2 stars
  grey:  "text-zinc-400",    // null / N/A
};

function getColorClass(rating: number | null): string {
  if (rating === null) return BAND_COLORS.grey;
  if (rating >= 4) return BAND_COLORS.green;
  if (rating === 3) return BAND_COLORS.amber;
  return BAND_COLORS.red;
}

export function StarRating({ rating }: { rating: number | null }) {
  if (rating === null) {
    // D-06: suppressed → grey "N/A", NO glyphs
    return <span className="text-zinc-400 not-italic">N/A</span>;
  }
  const colorClass = getColorClass(rating);
  const glyphs = Array.from({ length: 5 }, (_, i) =>
    i < rating ? "★" : "☆"
  ).join("");
  return (
    <span className={`${colorClass} font-medium`}>
      {glyphs} {rating}/5
    </span>
  );
}
```

### Pattern 2: PDF Star Rating (react-pdf SVG Path)

A 5-pointed star can be computed with polar coordinates. The standard SVG `<path>` for a 5-star with outer radius `R` and inner radius `r`:

```tsx
// src/components/pdf/PdfStarRating.tsx — NO "use client"
// Source: @react-pdf/renderer SVG primitives (Svg, Path confirmed exported)
import { Svg, Path, View, Text } from "@react-pdf/renderer";

// Pre-computed SVG path for a single star (outer R=8, inner r=3.5, centered at 8,8)
const STAR_PATH = "M8,1 L9.9,6.2 L15.5,6.2 L11,9.5 L12.9,14.7 L8,11.4 L3.1,14.7 L5,9.5 L0.5,6.2 L6.1,6.2 Z";
const BAND_FILL: Record<string, string> = {
  green: "#16a34a",
  amber: "#f59e0b",
  red:   "#dc2626",
  grey:  "#9ca3af",
};

function getFill(rating: number | null): string {
  if (rating === null) return BAND_FILL.grey;
  if (rating >= 4) return BAND_FILL.green;
  if (rating === 3) return BAND_FILL.amber;
  return BAND_FILL.red;
}

export function PdfStarRating({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <Text style={{ color: "#9ca3af" }}>N/A</Text>;
  }
  const fill = getFill(rating);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Svg key={i} width={16} height={16} viewBox="0 0 16 16">
          <Path d={STAR_PATH} fill={i < rating ? fill : "none"} stroke={fill} strokeWidth={0.8} />
        </Svg>
      ))}
      <Text style={{ color: fill, marginLeft: 4 }}>{rating}/5</Text>
    </View>
  );
}
```

**Important:** The SVG `<Path>` `d` attribute must be verified visually in the rendered PDF. The path above is a reference starting point — confirm the star renders correctly (filled vs outline, proportions) before finalising.

### Pattern 3: Web Metric BarChart (recharts v2)

```tsx
// src/components/MiniBarChart.tsx — "use client"
// Source: recharts v2 docs; D-07/D-08/D-09
import { BarChart, Bar, XAxis, YAxis, Legend, Cell, Tooltip, ResponsiveContainer } from "recharts";

// D-08: series identity colors (NOT performance bands)
const FACILITY_COLOR = "#3b82f6"; // blue
const NATION_COLOR   = "#16a34a"; // green
const STATE_COLOR    = "#f59e0b"; // amber

export function MiniBarChart({
  facilityValue, nationValue, stateValue,
  unit, measureLabel
}: MiniBarChartProps) {
  // D-09: suppressed → omit bar, show "N/A" tick
  const data = [
    { name: "Facility", value: facilityValue, color: FACILITY_COLOR },
    { name: "National", value: nationValue,   color: NATION_COLOR   },
    { name: "State",    value: stateValue,    color: STATE_COLOR    },
  ].filter((d) => d.value !== null);

  if (data.length === 0) return <span className="text-xs text-zinc-400">N/A</span>;

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
        <XAxis dataKey="name" tick={{ fontSize: 9 }} />
        <YAxis tick={{ fontSize: 9 }} width={32} />
        <Tooltip formatter={(v: number) => unit === "percent" ? `${v.toFixed(1)}%` : v.toFixed(2)} />
        <Bar dataKey="value">
          {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**D-08 legend note:** A recharts `<Legend>` with custom `payload` built from the `data` array mapping name→color serves as the measure-identity legend. Keep palette visually distinct from the star bands (blue/green/amber bars vs green/amber/red stars).

### Pattern 4: PDF Metric BarChart (react-pdf-charts)

```tsx
// src/components/pdf/PdfMiniBarChart.tsx — NO "use client"
// Source: react-pdf-charts README + installed node_modules/react-pdf-charts/dist/index.d.ts
import ReactPDFChart from "react-pdf-charts";
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";
import { View } from "@react-pdf/renderer";

// CRITICAL: isAnimationActive={false} on every <Bar> — required for server-side rendering.
// Without it, recharts animation code runs during renderToStaticMarkup and the SVG
// output may be empty or partial (react-pdf-charts Known Issues).

export function PdfMiniBarChart({ data, unit }: PdfMiniBarChartProps) {
  const filtered = data.filter((d) => d.value !== null);
  if (filtered.length === 0) return null;

  return (
    <View>
      <ReactPDFChart>
        <BarChart width={300} height={100} data={filtered}>
          <XAxis dataKey="name" tick={{ fontSize: 7 }} />
          <YAxis tick={{ fontSize: 7 }} width={28} />
          <Bar dataKey="value" isAnimationActive={false}>
            {filtered.map((entry, i) => (
              <Cell key={i} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ReactPDFChart>
    </View>
  );
}
```

**react-pdf-charts mechanism:** `ReactPDFChart` calls `renderToStaticMarkup(children)` on the recharts tree, generating an SVG HTML string, then uses `html-react-parser` to convert SVG elements to react-pdf `<Svg>/<Path>/<Rect>` etc. primitives. This runs entirely server-side (no browser DOM required). `isAnimationActive={false}` is mandatory because recharts animations may fail during `renderToStaticMarkup` (confirmed in react-pdf-charts Known Issues section and README).

### Pattern 5: SVG→PNG Rasterization for docx (NEW)

```typescript
// src/lib/charts/rasterize.ts — server-only (NO "use client")
// Source: @resvg/resvg-js npm package API
import { Resvg } from "@resvg/resvg-js";

/**
 * Rasterizes an SVG string to a PNG Buffer.
 * Used in the docx route to create ImageRun chart PNGs.
 * Width/height must be set to control PNG dimensions and file size.
 */
export function svgToPngBuffer(svgString: string, width = 300, height = 100): Buffer {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: width },
  });
  const pngData = resvg.render();
  return Buffer.from(pngData.asPng());
}
```

**Vercel compatibility:** `@resvg/resvg-js` ships optional NAPI platform packages including `@resvg/resvg-js-linux-x64-gnu` (Vercel Lambda is Linux x64 glibc). npm installs the platform-appropriate optional dep automatically. The package has a Vercel playground at resvg-js.vercel.app confirming it runs on Vercel. Must be in `serverExternalPackages` — NOT in Next.js auto-external list.

**Generating the SVG string from recharts for rasterization:**
```typescript
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { BarChart, Bar, XAxis, YAxis, Cell } from "recharts";

function renderChartToSvg(data: ChartData[], width = 300, height = 100): string {
  return renderToStaticMarkup(
    createElement(BarChart, { width, height, data },
      createElement(XAxis, { dataKey: "name" }),
      createElement(YAxis),
      ...data.map((d, i) =>
        createElement(Cell, { key: i, fill: d.color })
      ),
      createElement(Bar, { dataKey: "value", isAnimationActive: false })
    )
  );
}
```

**Then in `buildReportDocxBuffer`:** After generating the SVG string, call `svgToPngBuffer(svgString)`, then inject as `ImageRun({ type: "png", data: pngBuffer, transformation: { width: 300, height: 100 } })`.

### Pattern 6: docx Unicode Star TextRun (colored run in OOXML)

```typescript
// In buildValueMap() / ReportDocx.ts
// For a rating row, instead of the plain formatRating string, inject Unicode stars + OOXML color
function buildStarRunXml(rating: number | null): string {
  if (rating === null) return `<w:r><w:rPr><w:color w:val="9ca3af"/></w:rPr><w:t>N/A</w:t></w:r>`;
  const fill = rating >= 4 ? "16a34a" : rating === 3 ? "f59e0b" : "dc2626";
  const glyphs = "★".repeat(rating) + "☆".repeat(5 - rating);
  return `<w:r><w:rPr><w:color w:val="${fill}"/></w:rPr><w:t xml:space="preserve">${glyphs} ${rating}/5</w:t></w:r>`;
}
```

The OOXML injection replaces the `<w:t>` text node in the value cell, same as the current `buildValueMap` + XML regex approach. For star rows, instead of setting a plain string in the MAP, inject a pre-built OOXML run fragment. The existing `row.replace()` callback pattern in `ReportDocx.ts` handles this by replacing the entire value-cell content.

### Pattern 7: 300ms Debounce in SnapshotApp

```typescript
// src/hooks/useDebounce.ts — "use client" context
import { useEffect, useState } from "react";

export function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debouncedValue;
}
```

In `SnapshotApp`:
```typescript
const debouncedManualInputs = useDebounce(manualInputs, 300);
const vm = facilityData
  ? assembleViewModel(facilityData, debouncedManualInputs, new Date(), hospMetrics)
  : null;
```

`ManualInputsForm` continues to fire `onChange` on every keystroke (updating `manualInputs`). The debounce produces a 300ms delayed copy used ONLY for `vm` assembly. The `ExportControls` reads the same `vm`, so export is consistent with the debounced preview. **No CMS re-fetch** — `handleSearch` is unchanged.

**Why not `useDeferredValue`:** `useDeferredValue<T>(value, initialValue?)` in React 19 defers to the next render pass but has no guaranteed minimum delay. In concurrent React, this could update in <16ms on a fast machine, giving a sub-1ms debounce — useless as a "300ms" requirement. It is intended for deprioritizing expensive renders (like heavy list re-renders), not for rate-limiting user input.

### Anti-Patterns to Avoid

- **Recharts inside `<Document>` directly (no `ReactPDFChart` wrapper):** Charts render as blank space. `@react-pdf/renderer` uses its own reconciler; DOM charting APIs (`window`, `canvas`) do not exist in its render context.
- **`isAnimationActive` omitted on `<Bar>`:** Charts may render as empty rectangles in the PDF. Always set `isAnimationActive={false}` on `<Bar>`, `<Line>`, `<Area>`, and any other animated recharts child inside `ReactPDFChart`.
- **Sharp for SVG→PNG on Vercel:** Sharp SVG input requires the `librsvg` system library, which is NOT present in Vercel's Lambda container. Sharp works for JPEG/PNG→PNG but NOT for SVG input on Vercel.
- **Canvas (node-canvas) for rasterization:** Requires system libcairo — also absent in Vercel Lambda. Listed in Next.js auto-external list but still fails at runtime without system libraries.
- **`@resvg/resvg-js` without `serverExternalPackages`:** The NAPI `.node` binary cannot be bundled by Next.js/Turbopack. Without the explicit entry in `serverExternalPackages`, the route will throw `Cannot find module` at runtime.
- **PdfRow value prop as `React.ReactNode` with JSX:** `PdfRow` currently accepts `value: string`. For star glyphs, the value cell must be replaced with a `<View>` containing the `PdfStarRating` component. Either create `PdfRatingRow` variant or change `PdfRow` to accept `ReactNode` in the value cell (but `value: string` elsewhere must stay for non-rating rows).
- **Debounce on `facilityData` state (re-triggers CMS re-fetch):** The debounce applies only to `manualInputs` → `vm` path. `handleSearch` remains un-debounced and is the only CMS fetch trigger.
- **Checking charts in the web preview:** Web preview uses recharts DOM rendering. PDF uses react-pdf-charts. They are independent — a chart that shows in the web preview may still be blank in the PDF if `isAnimationActive` is missing or if the chart SVG output has unsupported elements.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG→PNG rasterization | Custom Rust/WASM pipeline, puppeteer | `@resvg/resvg-js` | Ships Linux x64 binary; works on Vercel Lambda without system libs |
| recharts→react-pdf conversion | Walk recharts VDOM manually | `react-pdf-charts` (already installed) | `renderToStaticMarkup` + html-react-parser handles the full SVG element set including gradients, defs, tspan |
| Debounce timer | Redux middleware, rxjs, complex state machine | 5-line `useEffect`/`setTimeout` hook | This use case is straightforward; adding a library for it adds bundle weight with zero gain |
| 5-point star geometry | Third-party star icon library | Inline SVG `<Path>` with polar-coordinate math | react-pdf SVG primitives can't render HTML icons; a 14-point path string is all that's needed |
| Color band logic | Complex theme engine | Inline conditional (`>= 4 → green`) | Three cases, one conditional; no abstraction needed |

**Key insight:** Every custom solution in this domain (SVG, chart libraries, rasterization) has known failure modes in the serverless environment. Use the verified pre-built path.

---

## Common Pitfalls

### Pitfall 1: Charts Blank in PDF (HIGH recovery cost)

**What goes wrong:** A recharts `<BarChart>` renders correctly in the web preview but appears as blank white space in the downloaded PDF file.

**Why it happens:** Two independent root causes:
1. `isAnimationActive` not set to `false` — recharts animation code runs during `renderToStaticMarkup` and produces empty or partial SVG output.
2. recharts imported directly inside `<Document>` without `ReactPDFChart` wrapper — react-pdf's reconciler has no DOM and cannot render recharts.

**How to avoid:**
- Always use `<ReactPDFChart>` as the wrapper.
- Set `isAnimationActive={false}` on every `<Bar>`, `<Line>`, `<Area>`, `<Pie>`, `<Radar>` etc. inside the wrapper.
- Ensure recharts and react-pdf-charts are listed in `serverExternalPackages` in `next.config.ts` if they fail to load (react-pdf-charts is not auto-listed).

**Warning signs:** Web preview shows charts, downloaded PDF shows blank rectangles or missing chart areas.

**Verification:** MUST open the actual downloaded PDF in a PDF viewer (not the browser preview). `poppler`/`pdftk` or a standard PDF reader — the browser may show the PDF differently than the react-pdf output.

### Pitfall 2: @resvg/resvg-js Binary Not Loading on Vercel

**What goes wrong:** `Cannot find module '@resvg/resvg-js'` or `Error loading native binding` in the Vercel production logs when the docx route attempts to rasterize a chart.

**Why it happens:** `@resvg/resvg-js` uses NAPI and loads a platform-specific `.node` binary. Next.js/Turbopack tries to bundle it at build time, which fails for native modules. Without `serverExternalPackages`, the `.node` file is not reachable at runtime.

**How to avoid:**
```ts
// next.config.ts
serverExternalPackages: ["@react-pdf/renderer", "@resvg/resvg-js"],
```
Then verify with `npm run verify:full` (next build) before deploying.

**Warning signs:** Works locally (where the Darwin binary is installed), fails on Vercel (where only the Linux x64 binary is available).

### Pitfall 3: DOCX Size Exceeds 4.5 MB with Chart PNGs

**What goes wrong:** Adding four 300×100 PNG images to the docx payload pushes `Buffer.byteLength(docxBuffer)` over `4_500_000`, causing `413 FUNCTION_PAYLOAD_TOO_LARGE` on Vercel.

**Why it happens:** PNGs are not lossy. A 300×100 recharts chart at 2× DPI can be 15–50 KB per image. Four images = 60–200 KB additional, well within the 4.5 MB budget. However, if chart width/height are set very large (e.g., 1200×800), a single PNG can exceed 1 MB.

**How to avoid:** Keep chart dimensions small (300×100 px for rasterization). The existing `< 4_500_000` assertion in `tests/api/export-docx.test.ts` (line 138) must remain and will catch regressions.

**Warning signs:** `docxBuffer.byteLength` growing significantly. Monitor in the test after adding `ImageRun`s.

### Pitfall 4: PdfRow Value Cell Type Mismatch

**What goes wrong:** `PdfRow` currently accepts `value: string`. Injecting a `<PdfStarRating>` component (which returns a `<View>`) requires the value cell to accept `React.ReactNode`. Changing the signature without updating all call sites breaks TypeScript strict mode.

**How to avoid:** Create `PdfRatingRow` variant that accepts a `ReactNode` for the value cell, OR change `PdfRow` to accept `React.ReactNode` and update the `<Text style={styles.valueText}>` wrapper to be conditional (only wrap string values in `<Text>`, pass non-string values through directly).

### Pitfall 5: React-pdf-charts Needs Both recharts AND react-pdf in Route Handler Bundle Scope

**What goes wrong:** `react-pdf-charts` imports from `@react-pdf/renderer` (the pdf SVG primitives). If `@react-pdf/renderer` is correctly in `serverExternalPackages` but `react-pdf-charts` is NOT, the pdf primitives may resolve to a different module instance, causing mismatched reconciler errors.

**How to avoid:** Since `@react-pdf/renderer` is in `serverExternalPackages` and react-pdf-charts is bundled normally by Next.js, their imports of `@react-pdf/renderer` are resolved from node_modules (the same instance). This should work correctly. If mismatched-instance errors appear, add `react-pdf-charts` to `serverExternalPackages` as well.

### Pitfall 6: D-15 Grouping Keys Not in ReportViewModelSchema

**What goes wrong:** `measureKey` and `source` are added to `HospMetric` in `types.ts` but not to `HospMetricSchema` in `view-model.ts`. The PDF and docx routes POST the `vm` and validate against `ReportViewModelSchema` — if `measureKey`/`source` are not in the schema, they are stripped during validation and the chart grouping breaks silently.

**How to avoid:** Any extension to `HospMetric` must be mirrored in `HospMetricSchema` (D-21 discipline). Add `measureKey: z.enum(["521","522","551","552"])` and `source: z.enum(["facility","nation","state"])` to `HospMetricSchema` before extending the interface.

### Pitfall 7: Star Glyph in OOXML Without xmlEsc

**What goes wrong:** `★` (U+2605) in OOXML `<w:t>` content is fine as-is (XML text nodes support Unicode). However, `☆` (U+2606) is also safe. The pitfall is if the star character is passed through `xmlEsc()` which does NOT escape Unicode characters — it only escapes `&`, `<`, `>`, `"`, `'`. This is correct behavior but must be confirmed if a future change to `xmlEsc` adds Unicode escaping.

**How to avoid:** Inject star glyphs as literal Unicode in the OOXML run fragment, not via the `buildValueMap` string path (which goes through `xmlEsc`). Build the OOXML `<w:r>` fragment directly.

---

## Runtime State Inventory

*This is a greenfield-additions phase, not a rename/refactor.* No stored data, OS-registered state, secrets, or build artifacts need migrating. The `HospMetricSchema` extension (D-15) adds optional fields — old view-model POSTs without `measureKey`/`source` will still parse if the new fields are `.optional()` in the schema, preserving backward compatibility.

**None — verified: no runtime state migration required.**

---

## "Looks Done But Isn't" — Live Vercel Smoke Checklist (SC#4)

Per PITFALLS.md lines 426–437, this phase must pass the following against `https://infinite-snapshot.vercel.app`:

| # | Check | How to Verify |
|---|-------|--------------|
| 1 | **Leading-zero CCN** | Submit CCN `056789` (or any with leading zero); confirm rendered report and downloaded PDF/docx show the CCN correctly |
| 2 | **Static PDF header** | Download PDF; confirm header shows `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` / `FL` — not the facility name |
| 3 | **"N/A" suppression** | Facility with null star rating renders `"N/A"` (grey, no glyphs) — not `0/5` or `☆☆☆☆☆` |
| 4 | **Font on Vercel** | Download PDF from the deployed URL (not localhost); confirm text is Helvetica, not a fallback |
| 5 | **Charts visible in opened PDF** | Open the downloaded PDF in a real PDF reader; confirm 4 mini bar charts are visible with colored bars — not blank rectangles |
| 6 | **Charts visible in opened docx** | Open the downloaded .docx in Word or render with LibreOffice; confirm 4 chart PNG images are embedded and visible |
| 7 | **All error states** | Submit `000000` (invalid), a valid-format non-existent CCN, and disconnect network mid-request; confirm distinct clean error messages each time |
| 8 | **.docx under 4 MB** | Download the .docx; file size must be under 4 MB (4,000,000 bytes, with margin from the 4.5 MB Vercel limit) |
| 9 | **`verify:full` green** | `npm run verify:full` green before declaring phase complete |
| 10 | **Star colors correct** | CCN 686123 Kendall Lakes: `overall_rating=4` → green stars; confirm band mapping |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All server routes | ✓ | v26.2.0 | — |
| npm | Package install | ✓ | (with Node) | — |
| `@react-pdf/renderer` | PDF star SVG + charts | ✓ installed | `^4.5.1` | — |
| `react-pdf-charts` | PDF bar charts | ✓ installed | `1.0.0` | — |
| `recharts` | Web + PDF charts | ✓ installed | `^2.15.4` | — |
| `docx` / `jszip` | docx builder | ✓ installed | `^9.7.1` / `^3.10.1` | — |
| `@resvg/resvg-js` | SVG→PNG for docx | ✗ NOT installed | — | `@resvg/resvg-wasm` (no NAPI needed, slower) |
| `sharp` (SVG input) | SVG→PNG for docx | ✗ (installed but SVG input requires librsvg) | `0.34.5` | Cannot use for SVG input on Vercel |

**Missing dependencies with no reliable fallback:**
- `@resvg/resvg-js` — must be installed and added to `serverExternalPackages` before docx chart images can be embedded on Vercel. The WASM variant (`@resvg/resvg-wasm`) is a viable fallback if the NAPI binary install fails.

**Missing dependencies with viable fallback:**
- None beyond the above.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.9` (node env) |
| Config file | `medelite-report/vitest.config.ts` |
| Quick run command | `npx vitest run tests/lib/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VIZ-01 | StarRating renders glyphs + number for rating 4 | unit | `npx vitest run src/components/StarRating.test.tsx` | ❌ Wave 0 |
| VIZ-01 | StarRating renders grey "N/A" for null rating (no glyphs) | unit | `npx vitest run src/components/StarRating.test.tsx` | ❌ Wave 0 |
| VIZ-01 | Color band: 4→green, 3→amber, 2→red, null→grey | unit | `npx vitest run src/components/StarRating.test.tsx` | ❌ Wave 0 |
| VIZ-02 | PdfStarRating returns SVG Svg/Path elements (not null) | unit | `npx vitest run src/components/pdf/PdfStarRating.test.tsx` | ❌ Wave 0 |
| VIZ-02 | PdfMiniBarChart wraps recharts with ReactPDFChart | unit | `npx vitest run src/components/pdf/PdfMiniBarChart.test.tsx` | ❌ Wave 0 |
| VIZ-02 | PDF route POST with vm returns 200 and valid PDF magic bytes | integration | `npx vitest run tests/api/export-pdf.test.ts` | ✅ exists |
| CLM-03 | 12 verbatim rows still present in PDF after chart additions | integration | `npx vitest run tests/api/export-pdf.test.ts` | ✅ exists |
| DOCX-01 | docx buffer with chart PNGs still < 4,500,000 bytes | integration | `npx vitest run tests/api/export-docx.test.ts` | ✅ exists |
| D-14 | `useDebounce(value, 300)` does not fire for <300ms | unit | `npx vitest run src/hooks/useDebounce.test.ts` | ❌ Wave 0 |
| D-15 | `groupByMeasure` returns 4 groups with correct keys | unit | `npx vitest run tests/lib/cms/claims-mapper.test.ts` | ✅ exists (extend) |
| D-06 | `formatRating(null)` → "N/A" (no regression) | unit | `npx vitest run tests/lib/report/format.test.ts` | ✅ exists |

**Critical non-automated verification (must be done manually):**
- Open the downloaded PDF in a real PDF reader (not browser preview) and confirm charts are visible with colored bars.
- Open the downloaded `.docx` in LibreOffice (per memory note: use LibreOffice render, not browser/mammoth) and confirm chart PNG images appear.
- Deploy to Vercel and run the SC#4 smoke checklist.

### Sampling Rate

- **Per task commit:** `npx vitest run` (full suite, ~seconds in node env)
- **Per wave merge:** `npm run verify:full` (typecheck + lint + format + test + next build)
- **Phase gate:** Full `verify:full` green + live Vercel smoke checklist before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `src/components/StarRating.test.tsx` — covers VIZ-01 star glyph + color band + null/N/A
- [ ] `src/components/pdf/PdfStarRating.test.tsx` — covers VIZ-02 SVG output (renders without null)
- [ ] `src/components/pdf/PdfMiniBarChart.test.tsx` — covers VIZ-02 ReactPDFChart wrapper
- [ ] `src/hooks/useDebounce.test.ts` — covers D-14 300ms delay semantics
- [ ] Framework install: none needed (Vitest already configured)

---

## Security Domain

`security_enforcement` is not explicitly set in config — treated as enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | All visual data flows through `ReportViewModelSchema.safeParse` before reaching export routes; `measureKey`/`source` extension must add enum constraints |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SVG injection via chart data | Tampering | Chart data comes from `vm.hospMetrics` — already validated by `HospMetricSchema` (numeric values only); no user-controlled SVG string injection possible |
| OOXML injection via star glyph OOXML fragment | Tampering | Star glyph OOXML is generated from `rating: number | null` (integer 1–5 or null) — no user-controlled string; color hex is from a closed enum |
| PNG ImageRun with oversized payload | DoS | Keep chart dimensions small (300×100); DOCX-01 size assertion guards the 4.5 MB limit |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual SVG-to-PDF for charts | `react-pdf-charts` wrapping recharts v2 | 2023 (library release) | Eliminates hand-rolling recharts→react-pdf conversion |
| `useDeferredValue` for debounce | Explicit `setTimeout`/`clearTimeout` hook | React 19 (concurrent) | `useDeferredValue` has no guaranteed delay in concurrent React 19 — use timer for precise UX requirements |
| Canvas-based SVG rasterization | NAPI-RS (`@resvg/resvg-js`) | ~2021 | Zero system library dependencies; works on Vercel Lambda without librsvg/libcairo |
| Direct `recharts` inside react-pdf | Impossible (incompatible reconcilers) | Always | Will never work; react-pdf-charts wrapper is the only viable approach |

**Deprecated/outdated:**
- `recharts v3`: Broken with `react-pdf-charts` due to SVG regression in v3. Pin `recharts@^2.15.4`.
- `html2canvas`/`jsPDF`: Forbidden by CLAUDE.md rule #7.
- `victory` in react-pdf: Not officially tested by react-pdf-charts; recharts v2 is the verified path.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@resvg/resvg-js` linux-x64-gnu binary works on Vercel Lambda without system library issues | Standard Stack, Pattern 5 | Must fall back to `@resvg/resvg-wasm` if NAPI fails; adds small performance penalty |
| A2 | `react-pdf-charts` calling `renderToStaticMarkup(recharts-tree)` in a Next.js route handler context works without DOM errors | Pattern 4 | recharts v2 has minimal DOM API usage; `renderToStaticMarkup` is server-safe; but if recharts v2 calls `window.*` during render the route will throw |
| A3 | The 5-point star `<Path d="...">` reference geometry in Pattern 2 produces visually correct filled/outline stars | Pattern 2 | Must be verified visually in the rendered PDF — the path string is a starting reference, not a guaranteed result |
| A4 | Four recharts 300×100 PNGs rasterized via `@resvg/resvg-js` will keep `docxBuffer.byteLength` under 4,500,000 | Common Pitfalls (Pitfall 3), DOCX-01 | The existing test assertion catches this — risk is LOW if chart dimensions stay small |

**If this table is empty:** All claims in this research were verified or cited — no user confirmation needed.

*A1 and A2 have medium risk; A3 and A4 are low risk with built-in mitigations.*

---

## Open Questions

1. **react-pdf-charts server-side DOM concern (A2)**
   - What we know: `react-pdf-charts` uses `renderToStaticMarkup` from `react-dom/server`. recharts v2 has 0 occurrences of `typeof window` guards in its `lib/index.js` (checked), but its animation system may reference `requestAnimationFrame` or similar.
   - What's unclear: Whether recharts v2 BarChart with `isAnimationActive={false}` produces clean SVG output via `renderToStaticMarkup` in a route handler (no DOM).
   - Recommendation: Implement and test immediately in Wave 1 by calling `renderToStaticMarkup(<BarChart ...><Bar isAnimationActive={false} /></BarChart>)` from a unit test. If it throws, fall back to hand-rolling react-pdf SVG bar rectangles (harder but guaranteed to work).

2. **Explicit vs positional metric grouping (D-15)**
   - What we know: The 12 rows are in fixed order. `METRIC_DEFINITIONS` has `measureKey` and `source` on each definition row.
   - What's unclear: Whether the planner wants to add `measureKey`/`source` to `HospMetric` + `HospMetricSchema` (more correct, requires schema change + test updates) vs derive groups positionally (simpler, fragile).
   - Recommendation: Add to `HospMetric`/`HospMetricSchema`. The schema change is minor; the robustness gain is significant. Must also be surfaced in the view-model passed to export routes.

3. **PdfRow value cell type (ReactNode vs string)**
   - What we know: `PdfRow` in `ReportPDF.tsx` takes `value: string` and wraps it in `<Text>`.
   - What's unclear: Whether to change `PdfRow` to accept `React.ReactNode` (affects all rows) or introduce a `PdfRatingRow` variant (only for star rows).
   - Recommendation: Create `PdfRatingRow` that accepts a `ReactNode` in the value slot. Avoids touching all non-rating rows and keeps the type change localized.

---

## Sources

### Primary (HIGH confidence)

- `medelite-report/node_modules/react-pdf-charts/dist/index.js` — implementation confirms `renderToStaticMarkup` mechanism, `isAnimationActive` requirement
- `medelite-report/node_modules/react-pdf-charts/README.md` — Known Issues: `isAnimationActive={false}` required for client-side; recharts v3 incompatible
- `medelite-report/node_modules/react-pdf-charts/dist/index.d.ts` — `ReactPDFChart` component API: `children`, `chartStyle`, `debug`, `style` props
- `medelite-report/node_modules/next/dist/lib/server-external-packages.jsonc` — confirmed: `@react-pdf/renderer`, `canvas`, `sharp` auto-listed; `@resvg/resvg-js` and `react-pdf-charts` NOT auto-listed
- `medelite-report/node_modules/docx/dist/index.d.ts` — `IImageOptions = (RegularImageOptions | SvgMediaOptions) & CoreImageOptions`; `RegularImageOptions.type: "png"` accepts `Buffer`; `SvgMediaOptions.type: "svg"` requires `fallback: RegularImageOptions`
- `medelite-report/node_modules/@types/react/index.d.ts` line 1861 — `useDeferredValue<T>(value: T, initialValue?: T): T` — no minimum delay guarantee
- `medelite-report/src/components/ReportPreview.tsx` — current web table structure; star rows use `formatRating()`
- `medelite-report/src/components/pdf/ReportPDF.tsx` — current PDF structure; `PdfRow` takes `value: string`
- `medelite-report/src/lib/docx/ReportDocx.ts` — OOXML template-fill via JSZip; callback-form replace pattern (CR-01)
- `medelite-report/src/lib/cms/claims-mapper.ts` — `METRIC_DEFINITIONS` with `measureKey`/`source` per row
- `medelite-report/src/lib/cms/types.ts` — `HospMetric` interface (no `measureKey`/`source` yet)
- `medelite-report/src/lib/report/view-model.ts` — `HospMetricSchema` (no `measureKey`/`source` yet)
- `medelite-report/src/components/SnapshotApp.tsx` — `vm` assembly location; `manualInputs` → `setManualInputs` flow
- `medelite-report/next.config.ts` — current `serverExternalPackages: ["@react-pdf/renderer"]`
- `npm view @resvg/resvg-js` — version 2.6.2, created 2021-10-09, optionalDependencies include `@resvg/resvg-js-linux-x64-gnu@2.6.2`

### Secondary (MEDIUM confidence)

- [react-pdf-charts GitHub repository](https://github.com/EvHaus/react-pdf-charts/blob/dev/README.md) — recharts v3 incompatibility warning, isAnimationActive requirement, server-side rendering stated as supported
- [resvg-js playground on Vercel](https://resvg-js.vercel.app) — confirms @resvg/resvg-js works on Vercel deployment
- [@resvg/resvg-js npm page](https://www.npmjs.com/package/@resvg/resvg-js) — NAPI-RS powered, platform optional deps for linux-x64-gnu

### Tertiary (LOW confidence)

- WebSearch results on `@resvg/resvg-js` Vercel Lambda compatibility — indirect confirmation via Vercel playground; no official Vercel docs stating explicit support

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages already installed and version-verified via node_modules
- Architecture: HIGH — integration seam files read directly; current code structure confirmed
- react-pdf-charts patterns: HIGH — implementation confirmed via `dist/index.js` source read
- @resvg/resvg-js Vercel compatibility: MEDIUM — NAPI binary confirmed for linux-x64-gnu; Vercel playground confirms general support; no official Vercel docs
- `useDeferredValue` vs timer: HIGH — TypeScript signature read from `@types/react`; React 19 semantics confirmed
- `PdfRow` value cell type: HIGH — current source code read

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (packages are stable; react-pdf-charts v1.0.0 is a static release)
