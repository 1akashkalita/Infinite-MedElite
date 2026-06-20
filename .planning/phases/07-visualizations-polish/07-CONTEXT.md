# Phase 7: Visualizations & Polish - Context

**Gathered:** 2026-06-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 7 turns the flat, template-faithful report into a **polished, visual** one, delivering the two visualization bonuses (**VIZ-01, VIZ-02**) plus the final live-deploy polish pass — **without disturbing any locked requirement or the template-fidelity standing rule.**

In scope:
- **Star rating visuals in the web UI** — the 4 rating rows (Overall, Health Inspection, Staffing, Quality of Resident Care) render color-coded star glyphs **in their value cells** (in-table replacement), not plain numbers (VIZ-01).
- **Star rating visuals in the PDF** — the same glyphs via **react-pdf SVG primitives** (`<Svg>/<Path>`), never recharts/DOM (VIZ-02).
- **Claims metric charts** — **four mini grouped-bar charts** (one per measure), each with facility/national/state bars, in the **web UI** (recharts v2) and the **PDF** (react-pdf-charts, `isAnimationActive={false}`) (VIZ-01/VIZ-02). The existing 12 verbatim metric rows stay (CLM-03 intact); charts are **added below** them.
- **Full visuals in the `.docx`** — Unicode star glyphs in colored runs + **embedded chart PNGs** (server-side rasterization), kept under the 4.5 MB Vercel limit.
- **300ms live-preview debounce** — manual-input edits update the preview within 300ms, debounced; **no CMS re-fetch** on manual edits.
- **The "Looks Done But Isn't" smoke pass on the live Vercel URL** — every checklist item in `PITFALLS.md` (leading-zero CCN, static PDF header, "N/A" suppression, font on Vercel, charts visible in the opened PDF, all error states, `.docx` < 4 MB, `verify:full` green).

Out of scope (do NOT pull in):
- **Benchmark comparison beyond the per-measure bars / better-vs-worse flag** → **v2 BENCH-01/BENCH-02** (deferred). The mini charts simply show the 3 values side by side; no green/red "you beat the benchmark" judgement.
- **Re-sourcing manual fields from CMS** (Current Census, Previous Provider Performance stay manual — Phase 3 D-12).
- **New report sections, new CMS fields, or header rebranding** (rule #2 locked).
- **Registering a custom brand font** — explicitly decided AGAINST this phase (D-13); keep built-in Helvetica / docx default for Vercel parity.

</domain>

<decisions>
## Implementation Decisions

### Placement — how visuals coexist with the locked template (Area 1)
- **D-01: Replace in-table, do NOT add a separate visuals band.** The visuals upgrade the **value cells** of the existing bordered template table; the labels, row order, and overall table structure stay template-exact. Chosen over an additive "visual snapshot" band above the table.
- **D-02: Stars replace the rating value cells.** The 4 rating rows render star glyphs in their value cells instead of a plain number (the plain-number example is superseded for ratings by VIZ-01 — the labels/order are unchanged, only the value rendering upgrades).
- **D-03: Metrics — keep all 12 verbatim rows AND add charts; charts never replace rows.** The 12 CLM-03 rows (verbatim garbled labels, exact API values, fixed order) render exactly as today; the four mini charts are added **below** the metric rows. This protects the locked CLM-03 requirement — a chart-only treatment that dropped the labels/values is **rejected**.

### Star rating cells (Area 2)
- **D-04: Each rating value cell shows glyphs + the number** — 5 stars (filled/outline) **plus** the numeric (e.g. `★★★★☆ 4/5`). Keeps the exact value visible (don't lean on color alone — accessibility) while adding the visual.
- **D-05: Glyphs color-coded by band (already specced, SC#1):** green for 4–5 stars, amber for 3, red for 1–2.
- **D-06: Null / suppressed rating → the locked `"N/A"` string in neutral grey, with NO glyphs.** Do not render 5 grey outline stars (reads as "zero score" rather than "not rated"). Honors the placeholder rule: `"N/A"` = suppressed CMS value (distinct from `"—"` = blank manual field). CMS ratings are integers 1–5 — **no half-star rendering needed.**

### Claims metric charts (Area 3)
- **D-07: Four mini grouped-bar charts — one per measure** (short-stay rehospitalization %, short-stay outpatient ED %, long-stay hospitalizations per 1,000, long-stay ED per 1,000). Each chart has 3 bars: facility / national / state. Chosen over two-charts-by-unit and one-combined-chart — each measure gets its own clean axis, which also avoids the %-vs-rate scale-mixing problem.
- **D-08: Three distinct bar hues — facility = blue, national = green, state = amber.** Chosen over "facility highlighted, benchmarks muted."
  - **Planner caveat:** these greens/ambers are **series identities (national/state), NOT performance bands** like the stars. The charts MUST carry a legend so a green "national" bar is not misread as "good." Keep the chart palette visually separable from the star green/amber/red bands.
- **D-09: Suppressed value → omit that bar + an "N/A" tick** in the chart (do not fake a zero-height bar as a real value). The 12 rows above still carry the full CLM-02 suppression message ("Not reported (small sample)"). A partially-suppressed measure still renders its chart with the available bars — do NOT hide the whole mini chart.

### Export scope & font (Area 4)
- **D-10: PDF gets full visuals (VIZ-02):** star glyphs via **react-pdf SVG primitives** (`<Svg>/<Path>`/`<Rect>` — NEVER recharts in the PDF), metric charts via **react-pdf-charts** (recharts v2 wrapped, `isAnimationActive={false}`). PITFALLS rates "charts blank in PDF" as HIGH recovery cost — build PDF visuals SVG-native from the start; **open the actual downloaded PDF to verify**, never trust the web preview.
- **D-11: `.docx` gets FULL visuals** — Unicode star glyphs (`★`/`☆`) in **colored `TextRun`s** matching the in-table band colors, AND the four mini charts as **embedded PNG images** (`ImageRun`).
  - **Research/planner item:** a **server-side chart-to-image pipeline** is required — render each chart's SVG and rasterize to PNG (e.g. `resvg`/`@resvg/resvg-js` or `sharp`), OR use `docx` `ImageRun` SVG support with a PNG fallback. **Confirm the approach works on Vercel's serverless runtime** (native-binary constraints) before committing. The route test MUST keep asserting `Buffer.byteLength(docxBuffer) < 4_500_000` **with images included** (DOCX-01).
- **D-12: Keep built-in fonts (Helvetica for PDF, docx default).** Carries forward Phase-4 D-03 (local == Vercel parity, zero font-load failure mode). Chosen over registering a custom brand font.
- **D-13: Do NOT register a custom brand font this phase.** PITFALLS #5 (CDN/`/public` fonts silently fall back **only on Vercel**) + the added DOCX image work make this the wrong risk to take now. Noted in Deferred Ideas if wanted later.

### Live-preview debounce (Claude's discretion within fixed constraints)
- **D-14: 300ms debounce on the manual-input → preview/view-model path; manual edits NEVER trigger a CMS re-fetch** (only `handleSearch` fetches — unchanged). The single assembled `vm` drives both the preview and `ExportControls`, so debouncing that one value keeps preview and export consistent (a 300ms delay is imperceptible for the deliberate export click). Mechanism (`useDeferredValue` vs. an explicit timer/`useDebounce`) is the planner's call.

### Chart data grouping (Claude's discretion — flag for planner)
- **D-15: Prefer EXPLICIT grouping of the 12 flat metrics into 4 measures × {facility, national, state}** over positional chunking. The grouping keys (`measureKey` + `source`) currently live only in `METRIC_DEFINITIONS` (`claims-mapper.ts`), not on the `HospMetric` exposed in the view-model. Planner decides whether to surface `measureKey`/`series` on `HospMetric`/the view-model (cleanest) or derive the 4 groups another way. **The 12 rows are already in fixed order** (measure1 facility/national/state, measure2 …), so positional chunk-by-3 is a fallback — but it's fragile; explicit keys are preferred. Either way, the CLM-03 row rendering stays unchanged.

### Claude's Discretion
- Exact glyph implementation per renderer (web Unicode/SVG; PDF `<Svg>` path geometry; docx Unicode) and shared color constants for the green/amber/red bands.
- Chart sizing, axis/label styling, legend placement, and exactly where below the 12 rows the four charts sit (grid vs stacked).
- Debounce mechanism (D-14) and any small `useDebounce`/`useDeferredValue` helper.
- The chart-to-image library choice for the `.docx` (D-11), subject to the Vercel-runtime + 4.5 MB constraints.
- Whether the star/chart rendering is factored into shared sub-components reused across preview/PDF (within the existing hand-written-per-renderer pattern — see Deferred "shared row-descriptor").

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec & rules
- `CLAUDE.md` (repo root) — standing rules: **#1 verify gate** (`npm run verify` / `verify:full`), **#2 static header** (logo/title/state; facility name body-only — visuals must not touch the header), **#4 Zod-validate** every CMS response / re-validate posted view-model, **#7 PDF uses `@react-pdf/renderer` only** (SVG primitives + react-pdf-charts; never html2canvas/jsPDF/DOM charts). Field-mapping table + Claims-metrics section (the 4 measures × 3 sources structure being charted).
- `medelite-report/AGENTS.md` / `medelite-report/CLAUDE.md` — **Next.js 16 caveat**: read the relevant guide in `medelite-report/node_modules/next/dist/docs/` before changing the export route handlers (the `.docx` route gains image rendering).

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 7: Visualizations & Polish" — goal + the 4 success criteria (SC#1 color-coded star glyphs; SC#2 PDF stars via react-pdf SVG + non-blank charts; SC#3 300ms debounce, no re-fetch; SC#4 the full live-Vercel checklist).
- `.planning/REQUIREMENTS.md` — **VIZ-01** (stars + key metrics as polished cards/charts in web UI), **VIZ-02** (visuals render in the PDF via react-pdf SVG / react-pdf-charts, never DOM charting). **Locked, must-not-regress:** CLM-02 (suppressed → "Not reported (small sample)"), CLM-03 (verbatim labels/order + API values), DOCX-01 (< 4.5 MB), RPT-02 (single shared view-model). **Deferred guardrail:** BENCH-01/BENCH-02 (comparison charts / better-worse flag are v2 — do NOT build).
- `.planning/phases/04-pdf-export/04-CONTEXT.md` — D-03 (built-in Helvetica, Vercel parity — basis for D-12/D-13), the PDF route/render patterns the SVG visuals slot into.
- `.planning/phases/05-claims-based-metrics/05-CONTEXT.md` — the 12-row claims structure + the full label→source→unit mapping the four charts group (4 measures × facility/national/state); suppression semantics (D-09 source for the chart "N/A tick").
- `.planning/phases/06-docx-export/06-CONTEXT.md` — `ReportDocx`/`ExportControls` patterns; **the deferred items this phase now picks up** (.docx star/chart visuals, custom font, the smoke checklist + 300ms debounce); D-06/D-07 (faithful docx replica via native primitives + `ImageRun`).

### Research (read before writing visual/chart/export code)
- `.planning/research/PITFALLS.md` — **#5** (font-on-Vercel footgun → D-12/D-13), the **"react-pdf charts" + "Charts blank in PDF" (HIGH recovery cost)** notes (build PDF visuals SVG-native; open the real PDF to verify), and the **"Looks Done But Isn't" checklist (lines 426–437)** — the verbatim SC#4 smoke list including ".docx under 4 MB" and "charts visible in opened PDF". Recovery-Strategies table for the chart/font/docx-size rows.
- `.planning/research/STACK.md` — `recharts ^2.15.4` (pin v2), `react-pdf-charts ^1.0.0` (adapter; `isAnimationActive={false}`), and the explicit "what NOT to use in react-pdf" list (no `<div>`/canvas/Chart.js/victory).
- `.planning/research/ARCHITECTURE.md` — single shared `ReportViewModel` → preview/PDF/docx. ⚠️ do NOT copy CMS field names from it (memory-sketched, wrong) — names come from the fixture/`view-model.ts`.

### Source files (the Phase-7 integration seam)
- `medelite-report/src/components/ReportPreview.tsx` — the web table; rating cells (`formatRating` → glyphs) + the 12 metric rows (charts added below the `<table>` or in a trailing section).
- `medelite-report/src/components/pdf/ReportPDF.tsx` — the PDF twin; `PdfRow` value cells → react-pdf `<Svg>` glyphs; charts via react-pdf-charts after the metric rows. **Mirror 1:1 with the preview.**
- `medelite-report/src/lib/docx/ReportDocx.ts` (+ `template.ts`) — the docx builder; colored-run star glyphs + `ImageRun` chart PNGs (D-11).
- `medelite-report/src/components/SnapshotApp.tsx` — owns `manualInputs` → `vm`; the debounce (D-14) lands here (debounce the value feeding `vm`, which drives both `ReportPreview` and `ExportControls`).
- `medelite-report/src/components/ManualInputsForm.tsx` — `onChange` currently fires the live (un-debounced) update; comment at top already flags "Phase 7 adds debounce."
- `medelite-report/src/components/ExportControls.tsx` — reads `vm`; posts to `/api/export/pdf|docx`. Unchanged contract; consumes the (now debounced) `vm`.
- `medelite-report/src/app/api/export/docx/route.ts` — gains the image-bearing build; keep the `< 4_500_000` assertion.
- `medelite-report/src/lib/report/format.ts` — `formatRating/Percent/Rate/Footnote` reused verbatim so visual values match text values (real `0` ≠ N/A).
- `medelite-report/src/lib/report/view-model.ts` — `ReportViewModel`/`ReportViewModelSchema`/`HospMetricSchema`; candidate extension point for explicit chart grouping keys (D-15).
- `medelite-report/src/lib/cms/types.ts` (`HospMetric`) + `medelite-report/src/lib/cms/claims-mapper.ts` (`METRIC_DEFINITIONS` with `measureKey`/`source`) — where the 4×3 grouping lives today (D-15).
- `medelite-report/src/lib/report/logo.ts` — static brand mark (header stays untouched, rule #2).
- `medelite-report/next.config.ts` — `serverExternalPackages` (already `@react-pdf/renderer`; planner confirms whether any chart-rasterizer needs adding).

### External
- recharts v2 docs (`BarChart`, grouped bars, `isAnimationActive`), react-pdf-charts (recharts→react-pdf adapter), `@react-pdf/renderer` SVG primitives (`Svg`, `Path`, `Rect`, `G`), `docx` `ImageRun` (PNG; SVG-with-fallback support), and the chosen SVG→PNG rasterizer (`@resvg/resvg-js` or `sharp`) — verify current APIs + Vercel-runtime compatibility via Context7 / official docs.
- Live URL: `https://infinite-snapshot.vercel.app` (push to `main` auto-deploys; root dir `medelite-report`). Test facility **CCN 686123** (Kendall Lakes, FL).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Single assembled `vm` in `SnapshotApp`** drives `ReportPreview` + `ExportControls` — debouncing this one value (D-14) keeps preview and export consistent without a live/debounced split.
- **`ReportPreview` ↔ `ReportPDF` 1:1 mirror** — every visual added to one must be added to the other (the existing discipline); the PDF uses SVG, the web can use Unicode/SVG/CSS.
- **`format.ts` formatters** — reuse verbatim so glyph/number values match the text values exactly (`=== null` semantics; real `0` renders, not N/A).
- **The 12 `HospMetric` rows in fixed order** (4 measures × facility/national/state) — chartable by explicit `measureKey`/`source` (preferred, D-15) or positional chunk-by-3 (fallback).
- **`ReportDocx`/`ExportControls` + the `/api/export/docx` route** (Phase 6) — extend in place for star runs + `ImageRun` charts; keep the size assertion.

### Established Patterns
- Server-only export modules (`@react-pdf/renderer`, `docx`, and any rasterizer) must never reach a `"use client"` bundle — `next build` fails if they do (PITFALLS #4). Web charts (recharts) are client-side; PDF/docx charts are server-side.
- TS strict + `isolatedModules`; `@/*` alias; Tailwind v4 (web only); Vitest node env (`tests/**/*.test.ts`, `src/**/*.test.ts`). `npm run verify` is the gate; this phase touches the bundle + export routes → close on **`npm run verify:full`** (adds `next build`).
- Placeholder discipline: `"N/A"` = suppressed CMS value (locked, em dash rejected); `"—"` = blank manual field. The star/chart "N/A" treatments (D-06/D-09) follow this.

### Integration Points
- `ManualInputsForm.onChange` → (debounce, D-14) → `manualInputs` → `vm` → `ReportPreview` (glyphs + charts) and `ExportControls` (PDF/docx).
- `vm.facility.starRatings` → star glyph renderers (web/PDF/docx).
- `vm.hospMetrics` (12 rows) → 12 verbatim rows (unchanged) **+** grouped into 4 mini charts (web recharts / PDF react-pdf-charts / docx PNG).
- Live deploy: push `main` → Vercel build → run the SC#4 smoke checklist against `infinite-snapshot.vercel.app` (open the real PDF + docx, not just the preview).

</code_context>

<specifics>
## Specific Ideas

- **Star cell:** `★★★★☆ 4/5`, glyphs colored by band (green 4–5 / amber 3 / red 1–2); null → grey `N/A`, no glyphs.
- **Metric charts:** four mini grouped-bar charts (one per measure), bars = facility (blue) / national (green) / state (amber), with a legend; suppressed bar omitted + `N/A` tick; charts sit **below** the 12 verbatim rows.
- **`.docx`:** colored Unicode star runs + four embedded chart PNGs; stays `< 4_500_000` bytes.
- **Fonts:** built-in Helvetica / docx default (no custom font).
- **Debounce:** 300ms on manual edits → preview; no CMS re-fetch.
- Verify on the **opened PDF and opened `.docx`** (poppler/LibreOffice render), not the browser preview — charts can render in DOM but blank in react-pdf.

</specifics>

<deferred>
## Deferred Ideas

- **Benchmark verdict visuals (BENCH-01/BENCH-02)** — comparison charts beyond the 3-bar mini charts, and a better/worse-than-benchmark flag/color. Explicitly **v2** — the mini charts show values side by side without a judgement. Do NOT build in Phase 7.
- **Registered custom/brand font** — decided against this phase (D-13) for Vercel-parity safety; revisit later with a dedicated live-Vercel font verification if brand typography becomes a priority.
- **Shared cross-renderer row/visual descriptor** — a single source of truth for the rating/metric rendering consumed by preview + PDF + docx (now that there are three renderers AND visuals). Real maintainability win, but a refactor with its own risk — carried forward from Phase 6's deferred list; out of scope here.

### Reviewed Todos (not folded)
None — `todo.match-phase 7` returned zero matches.

</deferred>

---

*Phase: 7-Visualizations & Polish*
*Context gathered: 2026-06-20*
