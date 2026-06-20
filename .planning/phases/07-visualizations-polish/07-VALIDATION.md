---
phase: 7
slug: visualizations-polish
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-20
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> ⚠ Visual-render caveat (from RESEARCH.md): charts can render in the DOM but blank in react-pdf, and the web preview is an independent pipeline from the PDF/docx. Automated tests prove structure/values; **the rendered-artifact checks (open the real PDF + .docx) are Manual-Only and gate phase sign-off.**

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node env) |
| **Config file** | `medelite-report/vitest.config.ts` — `environment: "node"`, `include: ["tests/**/*.test.ts", "src/**/*.test.ts"]`. **Only `*.test.ts` runs — `.test.tsx` is NOT included.** Component `.tsx` files are imported INTO `.test.ts` files (esbuild transpiles the JSX); the returned React element tree is walked for structural assertions — no jsdom/DOM. |
| **Quick run command** | `npx vitest run <file>` (from `medelite-report/`) |
| **Full suite command** | `npm run verify` (typecheck → lint → format:check → test); **phase close on `npm run verify:full`** (adds `next build`) |
| **Estimated runtime** | ~10–25 seconds per file (node env, no browser); full suite ~under a minute |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run <touched file>` (quick)
- **After every plan wave:** Run `npm run verify` (Plan 02/03 waves: `npm run verify:full` — client-bundle + NAPI dependency)
- **Before `/gsd:verify-work`:** `npm run verify:full` must be green (this phase touches the client bundle + export routes + a NAPI dependency)
- **Max feedback latency:** ~25 seconds (single touched-file run)

---

## Per-Task Verification Map

> Reconciled with the PLAN.md files. Every VIZ-02 PDF component now has a structural `.ts` unit test (element-tree inspection) in addition to the route-level integration test, which alone only proves `renderToBuffer` doesn't crash. Threat Ref ties to each plan's `<threat_model>` block (security gate active, ASVS L1).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 7-01-1 | 01 | 1 | VIZ-01 (D-15) | T-7-01 | HospMetricSchema rejects open measureKey/source (closed `z.enum`) | unit | `npx vitest run src/lib/report/star-band.test.ts src/lib/report/chart-utils.test.ts tests/lib/cms/claims-mapper.test.ts tests/lib/report/view-model.test.ts` | ✅ | ⬜ pending |
| 7-01-2 | 01 | 1 | VIZ-01 / VIZ-02 | T-7-03 | PDF stars use `<Svg>/<Path>` (not Text fallback); null→grey N/A no glyphs (D-06) | unit (struct) + integration | `npx vitest run src/components/pdf/PdfStarRating.test.ts tests/api/export-pdf.test.ts && npx tsc --noEmit` | ✅ | ⬜ pending |
| 7-01-3 | 01 | 1 | VIZ-01 / VIZ-02 | T-7-02 | docx star OOXML run: closed-enum hex + integer only, literal Unicode, CR-01 callback replace; DOCX-01 size | integration | `npx vitest run tests/api/export-docx.test.ts` | ✅ | ⬜ pending |
| 7-02-1 | 02 | 2 | VIZ-02 | T-7-04 | Chart SVG built server-side from validated numeric vm only; PNG magic bytes | unit | `npx vitest run src/lib/charts/chart-svg.test.ts tests/lib/charts/rasterize.test.ts` | ✅ | ⬜ pending |
| 7-02-1a | 02 | 2 | VIZ-02 | T-7-06 / T-7-SC | `@resvg/resvg-js` [ASSUMED] legitimacy human-gate before install (non-auto-approvable) | manual gate | (blocking checkpoint — see plan) | n/a | ⬜ pending |
| 7-02-2 | 02 | 2 | VIZ-01 / VIZ-02 | T-7-04 | PDF chart wrapped in `ReactPDFChart`, every `<Bar>` `isAnimationActive={false}`, `<Legend>` present (D-08) | unit (struct) + integration | `npx vitest run src/components/pdf/PdfMiniBarChart.test.ts tests/api/export-pdf.test.ts && npx tsc --noEmit` | ✅ | ⬜ pending |
| 7-02-3 | 02 | 2 | VIZ-02 | T-7-05 / T-7-07 | docx 4 chart PNGs embedded, < 4_500_000 with images (DOCX-01), CR-01 callback rels/drawing inject | integration | `npx vitest run tests/api/export-docx.test.ts` | ✅ | ⬜ pending |
| 7-03-1 | 03 | 3 | SC#3 (VIZ-01 polish) | T-7-09 | useDebounce 300ms timer semantics; debounce wraps ONLY manualInputs→vm, no CMS re-fetch (D-14) | unit (fake timers) | `npx vitest run src/hooks/useDebounce.test.ts && npx tsc --noEmit` | ✅ | ⬜ pending |
| 7-03-2 | 03 | 3 | SC#3 | T-7-09 | Live: 300ms debounce + no `/api/facility` re-fetch on manual edits (Network tab) | manual | (blocking checkpoint — see plan) | n/a | ⬜ pending |
| 7-03-3 | 03 | 3 | SC#4 | — | Live-Vercel "Looks Done But Isn't" 10-item checklist on real opened artifacts | manual | (blocking checkpoint — see plan) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> All structural test scaffolds are authored TDD-alongside the implementing task (CLAUDE.md rule #5 — tests first or alongside, never after), as `.ts` files (node env). No separate Wave 0 plan; each implementing task ships with its automated `.ts` verify. All filenames below are `.test.ts` (NOT `.tsx`, which Vitest's include glob excludes).

- [x] VIZ-01 web star/grouping logic → `src/lib/report/star-band.test.ts` + `src/lib/report/chart-utils.test.ts` (band/glyph cases + 12-row→4-group grouping incl. partial; Plan 01 Task 1)
- [x] VIZ-02 PDF star geometry → `src/components/pdf/PdfStarRating.test.ts` (structural: rated input → Svg/Path nodes; null → grey N/A Text, no glyphs; Plan 01 Task 2)
- [x] VIZ-02 PDF chart adapter/legend → `src/components/pdf/PdfMiniBarChart.test.ts` (structural: ReactPDFChart wrapper + every `<Bar>` `isAnimationActive={false}` + `<Legend>` present; empty group → no `<Bar>`; Plan 02 Task 2)
- [x] VIZ-02 chart SVG→PNG server pipeline → `src/lib/charts/chart-svg.test.ts` (buildChartData null-filter + `<svg` string) + `tests/lib/charts/rasterize.test.ts` (PNG magic bytes; Plan 02 Task 1)
- [x] SC#3 debounce → `src/hooks/useDebounce.test.ts` (fake-timer 300ms semantics; Plan 03 Task 1)
- [x] docx star runs + embedded chart PNGs → asserted by extending `tests/api/export-docx.test.ts` (colored `<w:color>` star run + `★`; `word/media/chart-*.png` + relationship; < 4_500_000 with images; Plans 01 Task 3 / 02 Task 3)
- [x] Regression guards (existing suites kept green): CLM-02 (suppressed → "Not reported (small sample)"), CLM-03 (verbatim labels/order + API values), DOCX-01 (`Buffer.byteLength(docxBuffer) < 4_500_000` with images included), RPT-02 (single shared view-model)

*Existing Vitest infrastructure covers the harness — no framework install needed. The only new package (`@resvg/resvg-js`) is a render dependency gated by the Plan 02 legitimacy checkpoint, not a test framework.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Charts render as filled shapes in the **opened** PDF (not blank rectangles), with a legend | VIZ-02 / D-08 | react-pdf SVG output cannot be asserted by unit tests; DOM render ≠ PDF render | Download the PDF for CCN 686123 from the live Vercel URL; open it (poppler/render) and confirm 4 grouped-bar charts (with legend) + star glyphs are visible |
| Star glyphs + chart PNGs render in the **opened** `.docx` | VIZ-01/VIZ-02 | docx ImageRun/colored-run rendering must be visually confirmed | Download `.docx`; open with LibreOffice; confirm colored star runs and 4 embedded chart images appear; confirm file < 4.5 MB |
| Color bands correct (green 4–5 / amber 3 / red 1–2; chart hues blue/green/amber with legend) | VIZ-01 | Visual/perceptual judgement | Inspect web preview + opened PDF/docx for CCN 686123 |
| 300ms debounce, no CMS re-fetch on manual edits | SC#3 (VIZ-01 polish) | Timing/network behavior | Edit a manual input; confirm preview updates ~300ms later and the network tab shows no CMS fetch |
| Full "Looks Done But Isn't" smoke checklist on live Vercel URL | SC#4 | End-to-end deployed behavior | Run the verbatim PITFALLS checklist against `infinite-snapshot.vercel.app` |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (every code-producing task has a `.ts` automated verify that actually runs in node env; the 3 remaining manual items are inherently visual/timing/deploy checks)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (each VIZ-02 PDF component now has a structural `.ts` test; no `.tsx` test names remain)
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [x] Feedback latency < ~25s (single-file run)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved (Nyquist reconciled — structural `.ts` coverage added for VIZ-02 PDF star + chart components; `.tsx` test names removed)
