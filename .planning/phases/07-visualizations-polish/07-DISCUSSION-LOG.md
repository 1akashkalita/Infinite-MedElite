# Phase 7: Visualizations & Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-20
**Phase:** 7-Visualizations & Polish
**Areas discussed:** Visuals vs. template, Star rating card design, Claims metric charts, Export scope & font

---

## Visuals vs. template (Placement)

| Option | Description | Selected |
|--------|-------------|----------|
| Additive band | Keep the faithful template table exactly as-is; add a separate "visual snapshot" band (cards + charts). Lowest fidelity risk. | |
| Replace in-table | Upgrade the value cells (stars, charts) inside the template table; labels/order unchanged. More integrated; disturbs the verified flat-rows example. | ✓ |

**User's choice:** Replace in-table.
**Notes:** Flagged the tension with the template-fidelity standing rule and the locked CLM-03 requirement. Resolved via the metrics follow-up below — labels/order stay, only value rendering upgrades.

### Metrics follow-up (within Replace in-table)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep rows + add chart | Preserve all 12 verbatim-labeled rows + exact values (CLM-03 intact); add grouped-bar chart(s). | ✓ |
| Chart replaces rows | Chart stands in for the 12 rows; drops verbatim labels/values — would regress CLM-03. | |

**User's choice:** Keep rows + add chart.
**Notes:** Protects the locked CLM-03 (verbatim garbled labels, exact API values, fixed order).

---

## Star rating card design

| Option | Description | Selected |
|--------|-------------|----------|
| Glyphs + number | 5 color-coded stars + the numeric (`★★★★☆ 4/5`). Keeps exact value; not color-only. | ✓ |
| Glyphs only | 5 color-coded stars, no number. Cleanest, drops the exact numeric. | |

**User's choice:** Glyphs + number.

### Null / suppressed rating follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| "N/A" text, no glyphs | Locked "N/A" string in grey, no stars (avoids "zero score" misread). | ✓ |
| 5 grey outline stars | Empty outline stars + "N/A"; more uniform, but reads as a low score. | |

**User's choice:** "N/A" text, no glyphs.
**Notes:** Color bands green 4–5 / amber 3 / red 1–2 already specced (SC#1). CMS ratings are integers — no half-stars.

---

## Claims metric charts

| Option | Description | Selected |
|--------|-------------|----------|
| Two charts by unit | One chart for the 2 percent measures, one for the 2 rate measures. | |
| Four mini charts | One small grouped-bar chart per measure (4 total), each 3 bars (facility/national/state). | ✓ |
| One combined chart | All 4 measures × 3 series on one axis; mixes %/rate scales — misleading. | |

**User's choice:** Four mini charts.

### Bar color follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Facility highlighted | Facility saturated, national/state muted greys. | |
| Three distinct hues | Facility blue / national green / state amber. | ✓ |

**User's choice:** Three distinct hues.
**Notes:** Planner caveat captured — these are series identities, not performance bands; a legend is required so green "national" isn't read as "good."

### Suppressed-value follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Omit bar + N/A tick | Drop the missing bar, mark "N/A"; rows above carry the CLM-02 message. | ✓ |
| Hide whole mini chart | Hide the measure's chart if any value is suppressed. | |

**User's choice:** Omit bar + N/A tick.

---

## Export scope & font

| Option | Description | Selected |
|--------|-------------|----------|
| Stars only in DOCX | DOCX gets colored star glyphs; metric charts stay flat rows. | |
| Flat DOCX | DOCX entirely flat; web + PDF carry all polish (VIZ-02 still satisfied). | |
| Full visuals in DOCX | DOCX gets star glyphs AND embedded chart PNGs (server-side rasterization). | ✓ |

**User's choice:** Full visuals in DOCX.
**Notes:** Flagged the implications — server-side SVG→PNG pipeline (resvg/sharp or docx SVG+fallback), Vercel serverless-runtime check, and keeping the route under the 4.5 MB limit with images included.

### Font follow-up

| Option | Description | Selected |
|--------|-------------|----------|
| Keep built-in | react-pdf Helvetica + docx default; local==Vercel parity, zero font-load risk. | ✓ |
| Register brand font | Custom font via https:// CDN; PITFALLS #5 Vercel fall-back risk; needs live verification. | |

**User's choice:** Keep built-in.

---

## Claude's Discretion

- 300ms debounce mechanism (`useDeferredValue` vs. timer); debounce the single `vm` value that drives both preview and export (no live/debounced split); manual edits never re-fetch CMS.
- Explicit grouping of the 12 flat metrics into 4 measures × {facility, national, state} preferred over positional chunking (surface `measureKey`/`series` on the view-model vs. derive) — planner's call.
- Per-renderer glyph implementation, chart sizing/labels/legend placement, exact chart position below the rows, shared color constants, and the `.docx` chart-rasterizer library choice.
- "Looks Done But Isn't" smoke-checklist execution against the live Vercel URL.

## Deferred Ideas

- Benchmark verdict visuals (BENCH-01/BENCH-02) — comparison charts beyond the 3-bar minis and a better/worse flag — v2, not Phase 7.
- Registered custom/brand font — declined this phase (D-13); revisit later with live-Vercel font verification.
- Shared cross-renderer row/visual descriptor — maintainability refactor across the three renderers; carried forward from Phase 6's deferred list.
