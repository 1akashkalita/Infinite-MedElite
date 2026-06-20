# Phase 6: .docx Export - Context

**Gathered:** 2026-06-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 6 adds a **downloadable `.docx` (Microsoft Word) export** alongside the existing PDF, generated **server-side via the `docx` library** (already installed, `^9.7.1`) from the **same shared `ReportViewModel`** that drives the web preview and the PDF. The Word document mirrors the report's content — static INFINITE logo header, the 13-field body table, the 12 hospitalization/ED claims rows, and a clickable Medicare Care Compare link — and is delivered to the user via a unified export control (a single Download button + a `PDF | DOCX` segmented toggle), kept well under the **4.5 MB Vercel response limit** (DOCX-01).

In scope (DOCX-01):
- A new `POST /api/export/docx` route that re-validates the posted `ReportViewModel` with `ReportViewModelSchema` and returns the Word document as a buffer (mirrors the Phase-4 `/api/export/pdf` contract: clean error envelope on bad input, `nodejs` runtime).
- A `docx`-library document builder (`ReportDocx` or equivalent) that reproduces the report content: centered logo image, title + state, the bordered 2-column body table (13 fixed fields), the 12 verbatim-labelled claims metric rows, the D-09 degraded line when metrics are absent, and the footer Medicare hyperlink + CMS processing date.
- **Replacing** the PDF-only `DownloadPdfButton` with a unified **`ExportControls`** component: one Download button + a `PDF | DOCX` segmented toggle; PDF pre-selected; POSTs to the correct route based on the selected format.
- Tests: route returns a buffer, `Buffer.byteLength(docxBuffer) < 4_500_000`, correct `Content-Type` (`application/vnd.openxmlformats-officedocument.wordprocessingml.document`) + `Content-Disposition` filename; the document opens cleanly in Word/Google Docs (human UAT).

Out of scope (later phases — do NOT pull in):
- Star-rating visual cards / charts in the `.docx` (recharts/visuals) → **Phase 7** (VIZ-01/02). Phase 6 renders ratings + metrics as the same flat label/value rows as the preview/PDF.
- 300ms debounce, the full "Looks Done But Isn't" Vercel smoke checklist → **Phase 7** (the checklist there includes ".docx under 4 MB" as a verification item).
- A registered custom/brand font → **Phase 7** (Phase 6 uses the `docx` default/built-in font, matching Phase-4 D-03's local==Vercel-parity rationale).
- Re-sourcing "Current Census" / "Previous Provider Performance" from CMS — those stay **manual** inputs (Phase 3 D-12; Phase 5 deferred observation).

</domain>

<decisions>
## Implementation Decisions

### Download / export control UX (the discussed area)
- **D-01: Single Download button + a `PDF | DOCX` segmented toggle** beside it — NOT two separate buttons, NOT a dropdown/split button. One format is always visibly selected; one tap switches format, one click downloads. (Chosen over the simpler "two separate buttons" carry-forward.)
- **D-02: Replace `DownloadPdfButton` with a unified `ExportControls` component.** A single client component owns the selected-format state + the shared loading/error logic, and POSTs to `/api/export/pdf` or `/api/export/docx` based on the toggle. Do NOT keep the PDF button intact and wrap it — consolidate into one component so format state and the in-flight/error states live in one place. `SnapshotApp` swaps `<DownloadPdfButton vm={vm} />` for `<ExportControls vm={vm} />`.
- **D-03: PDF is the pre-selected (default) format** — it's the required deliverable; DOCX is the bonus. The toggle starts on PDF.
- **D-04: The Download button label tracks the selected format** — reads `Download PDF` / `Download DOCX` to match the toggle, and shows `Generating…` while a request is in flight (carrying forward Phase-4 D-07 loading semantics).
- **D-05: Preserve the Phase-4 download mechanics and failure UX for BOTH formats (carry-forward).** Client `fetch` POST → `Blob` → silent anchor download (`URL.createObjectURL` + programmatic `<a download>` click + deferred `revokeObjectURL`, the WR-02 `setTimeout(…,0)` pattern). Button disabled until a successful `vm` exists (D-07). On any export failure, a single inline `role="alert"` message below the control, button stays enabled to retry (D-08) — never routed through the top `ErrorBanner`. The unified component shares this logic across both formats (one in-flight lock; switching format is allowed when idle).

### Layout & content fidelity (Claude's discretion — defaults locked here so planner doesn't re-decide)
- **D-06: Faithful replica of the PDF/preview layout, built with native `docx` primitives.** Unlike react-pdf (no CSS grid, per-cell borders), the `docx` library has real `Table`/`TableRow`/`TableCell` with borders and `ImageRun` for the logo — so the bordered 2-column table, centered logo header, and footer link are reproduced naturally as a Word-native bordered table. Match the `ReportPDF` look: centered logo → bold `reportTitle` → bold `stateLine` → bordered table (bold label left ~42% width, value right) → footer row (blue underlined Medicare link + grey "CMS processing date"). The user cares about visual replication of the template (not just data parity), so aim for a close visual match within Word's idiom.
- **D-07: Hand-port the 13 + 12 rows into the `docx` builder, mirroring how `ReportPDF.tsx` was built** — do NOT introduce a shared cross-renderer row-descriptor abstraction in this phase. Parity with the established pattern (preview and PDF each hand-write the rows) keeps risk low; the row labels/order/values are already locked (Phase 3 D-03, Phase 5 D-04). The triplication-reduction refactor is noted in Deferred Ideas.
- **D-08: Render values with the SAME formatters and N/A/suppression semantics** as preview/PDF: `formatRating`/`formatBeds`/`formatLocation`/`formatDate` for the 13 fields, `formatPercent`/`formatRate` + `formatFootnote` for the metric rows (real `0` ≠ N/A; `null` → footnote message). Manual fields fall back to `"—"` exactly as `ReportPDF` does. When `vm.hospMetrics === undefined`, render the single D-09 degraded line ("Hospitalization & ED metrics are temporarily unavailable.") in place of the 12 rows.
- **D-09: Static logo header via `ImageRun`, decoded from the existing `INFINITE_LOGO_DATA_URI` base64** (`src/lib/report/logo.ts`) — strip the data-URI prefix, decode to bytes, set `type: "png"` and dimensions from `INFINITE_LOGO_WIDTH`/`HEIGHT`. Rule #2: the header is the static INFINITE/Managed-by-MEDELITE brand mark, never the facility name; `displayName` appears only in the body table.

### Medicare link & document metadata (Claude's discretion — defaults locked)
- **D-10: Clickable Medicare link via `docx` `ExternalHyperlink`**, styled blue + underlined, labeled **"View official CMS profile on Medicare.gov"** (same label/styling as the PDF, D-04 from Phase 4). `link` = `vm.facility.careCompareUrl` (already validated as an `https://www.medicare.gov/...` URL by `ReportViewModelSchema`). Real clickable hyperlink, verified by opening the `.docx` in Word/Google Docs (rule #7 spirit — the source link travels with every export).
- **D-11: Set the document title property to `vm.facility.displayName`** (parity with `ReportPDF`'s `<Document title={f.displayName}>`). Optional nicety; fine to set if trivial.

### Route, filename & validation (mostly locked by Phase-4 parity — noted so planner doesn't re-decide)
- **D-12: `POST /api/export/docx` mirrors `POST /api/export/pdf`'s contract.** Validate the JSON body with `ReportViewModelSchema.safeParse`; non-JSON or invalid shape → `400 { error: { kind: "invalid_request", message: "Invalid report data." } }` (D-05 clean-envelope discipline — NO Zod internals). Valid body → build the doc, `Packer.toBuffer(doc)` → `200` with `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document` and the D-13 `Content-Disposition`. `export const runtime = "nodejs"` (the `docx` packer needs Node Buffer/zip). Research note for the planner: confirm whether `docx` must be added to `serverExternalPackages` in `next.config.ts` (read the Next.js 16 route-handler guide per AGENTS.md before writing the route).
- **D-13: Filename = `<slug(displayName)>-Snapshot.docx`, fallback `<sanitized-ccn>-Snapshot.docx`.** The existing `slugFilename` helper (`src/lib/report/slug.ts`) **hardcodes the `.pdf` extension** — generalize it to accept an extension parameter (or add a small sibling) so both routes share the same injection-safe allowlist sanitization (the CR-01 / T-04-03 logic). Both inputs remain client-controlled and must stay header-injection-safe. Update `slug.test.ts` for the parameterized form (do not weaken the existing PDF assertions).

### Claude's Discretion
- Exact `docx` document/builder file location (e.g. `src/lib/docx/ReportDocx.ts` or `src/components/docx/…`) and whether it's a function returning a `Document` vs. a small module of section builders — planner's call. Keep it server-only (imported only by the route), same discipline as `ReportPDF` (never reaches the client bundle).
- `ExportControls` component naming/placement (left pane of `SnapshotApp`, replacing the current `DownloadPdfButton` slot) and the segmented-toggle markup/styling (Tailwind), as long as it's accessible (keyboard-operable, the selected segment is programmatically indicated) and matches D-01..D-05.
- `docx` styling specifics (table border weights/colors, font sizes, spacing, default font family) to approximate the `ReportPDF`/preview look within Word's defaults — no custom `Font` registration this phase (Phase 7 polish).
- Page setup (US Letter portrait, to match the PDF) if `docx` section properties make it trivial.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec & rules
- `CLAUDE.md` (repo root) — standing rules: **#2 static header** (logo/title/state; facility name body-only — applies to the `.docx` header exactly as to the PDF), **#4 Zod-validate** every CMS response / re-validate the posted view-model, **#1 verify gate**, **#7 PDF uses @react-pdf/renderer only** (scopes the PDF; the `.docx` is the `docx` library — but the "source link travels with the export" intent carries over). Field-mapping table = the body field list.
- `medelite-report/AGENTS.md` / `medelite-report/CLAUDE.md` — **Next.js 16 caveat**: read the relevant guide in `medelite-report/node_modules/next/dist/docs/` before writing/changing the route handler (`Response`, route handlers, `serverExternalPackages`).

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 6: .docx Export" — goal + 3 success criteria (SC#1 opens cleanly in Word/Google Docs; SC#2 content matches the preview: header + facility data + manual inputs + claims metrics; SC#3 `< 4_500_000` byte assertion + `Content-Type`/`Content-Disposition`).
- `.planning/REQUIREMENTS.md` — **DOCX-01** (download a `.docx` alongside the PDF, matching content); **RPT-02** (single shared view-model drives preview + PDF + `.docx`).
- `.planning/phases/04-pdf-export/04-CONTEXT.md` — **the closest analog**: D-05 (fetch→blob→silent anchor download), D-06 (slug filename + CCN fallback), D-07 (button states), D-08 (inline retry error, not ErrorBanner), D-09 (route: validate body → render buffer → headers), D-03 (built-in fonts, Vercel parity rationale), D-01/D-02 (faithful replica, US Letter). Phase 6 ports this pattern to `docx`.
- `.planning/phases/05-claims-based-metrics/05-CONTEXT.md` — the 12-row claims structure the `.docx` must reproduce: D-03 (flat label/value rows), D-04 (verbatim garbled labels), D-09 (degraded one-line state), D-10/D-11 (per-row suppression + footnote messages), and the full 12-row label→value→source mapping table in its `<specifics>`.
- `.planning/phases/02-api-routes-view-model-config/02-CONTEXT.md` — the export-route contract origin (D-20/D-21 body validation, D-25 nodejs runtime + `serverExternalPackages`), `ReportViewModel`/`assembleViewModel`, `careCompareUrl` (D-16).

### Research (read before writing the docx/route code)
- `.planning/research/PITFALLS.md` — **#4** (`serverExternalPackages` / server-only export modules / never let the builder reach the client bundle — applies to `docx` import the same way as `@react-pdf/renderer`), **#5** (font registration footgun on Vercel — basis for using the default font), **#13** (header branding must never carry the facility name), "Looks Done But Isn't" checklist (the ".docx under 4 MB" item, open the file in Word — not just byte length).
- `.planning/research/ARCHITECTURE.md` — single shared `ReportViewModel` → preview/PDF/`docx`. ⚠️ do NOT copy CMS field names from it (memory-sketched, wrong).
- `.planning/research/STACK.md` — `docx ^9.7.1` (the Word export library; `Packer.toBuffer`).

### Source files (the Phase-6 integration seam)
- `medelite-report/src/components/pdf/ReportPDF.tsx` — **the content + layout to replicate** (13 body rows + 12 metric rows + degraded line + footer link + N/A semantics + rule-#2 header). The `.docx` builder is its `docx`-library twin.
- `medelite-report/src/lib/report/view-model.ts` — `ReportViewModel` / `ReportViewModelSchema` (the `.docx` route's input contract) + `careCompareUrl` (the hyperlink target) + `HospMetricSchema`.
- `medelite-report/src/lib/report/format.ts` — `formatRating/Beds/Location/Date/Percent/Rate` + `formatFootnote`; reuse verbatim so `.docx` values match preview/PDF.
- `medelite-report/src/lib/report/logo.ts` — `INFINITE_LOGO_DATA_URI` / `_WIDTH` / `_HEIGHT`; decode the base64 for `docx` `ImageRun` (D-09).
- `medelite-report/src/lib/report/slug.ts` — `slugFilename` (currently `.pdf`-hardcoded); generalize for the `.docx` extension (D-13); `tests/lib/slug.test.ts` to update.
- `medelite-report/src/app/api/export/pdf/route.tsx` — the route to clone for `/api/export/docx` (D-12): body validation, clean error envelope, nodejs runtime, buffer + `Content-Disposition`.
- `medelite-report/src/components/DownloadPdfButton.tsx` — the component being **replaced** by `ExportControls` (D-02); reuse its download/blob/error logic for both formats.
- `medelite-report/src/components/SnapshotApp.tsx` — owns the assembled `vm`; swap `<DownloadPdfButton vm={vm} />` for `<ExportControls vm={vm} />` in the left pane.
- `medelite-report/next.config.ts` — already declares `serverExternalPackages: ["@react-pdf/renderer"]`; planner confirms whether `docx` needs adding.

### External
- `docx` library docs (Word generation): `Document`, `Packer.toBuffer`, `Table`/`TableRow`/`TableCell` + borders, `Paragraph`/`TextRun`, `ImageRun`, `ExternalHyperlink`. Use Context7 / official docs for current v9 API.
- CMS Care Compare profile URL (already in `careCompareUrl`): `https://www.medicare.gov/care-compare/details/nursing-home/{CCN}`. Test facility CCN **686123** (Kendall Lakes, FL).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`ReportViewModel` + `assembleViewModel`** — the `.docx` renders straight from the already-assembled, already-validated model; no new data shape. `careCompareUrl`, `hospMetrics`, `displayName` all present.
- **`ReportPDF.tsx`** — the exact content/order/labels/N/A semantics to reproduce; the `.docx` builder is a 1:1 twin in a different library.
- **Formatters (`format.ts`)** — `formatRating/Beds/Location/Date/Percent/Rate` + `formatFootnote`; reuse so `.docx` values match preview/PDF exactly (real `0` preserved).
- **`logo.ts`** — `INFINITE_LOGO_DATA_URI` (base64 PNG) reused for the `docx` `ImageRun` header.
- **`slug.ts` `slugFilename`** — injection-safe filename helper; generalize the extension (D-13) so both routes share the CR-01 sanitization.
- **`DownloadPdfButton.tsx`** — its fetch→blob→anchor-download + D-07/D-08 logic is lifted into the new `ExportControls` (both formats).
- **`POST /api/export/pdf` route** — the exact contract to clone (validate → buffer → headers; clean envelope; nodejs runtime).

### Established Patterns
- Single shared `ReportViewModel`, assembled once, drives preview + PDF + `.docx` (RPT-02). Formatters run at render time; the model carries raw `number | null`.
- Server-only export modules: `@react-pdf/renderer` (and now the `docx` builder) must never reach a `"use client"` bundle — `next build` errors if they do (T-03-09 / PITFALLS #4). The client only imports `ReportViewModel` as a *type*.
- Next.js 16 App Router; route handlers are server/Node-only; `runtime = "nodejs"`; read `node_modules/next/dist/docs` guides first (AGENTS.md).
- TS strict + `isolatedModules` (every `.ts` needs import/export); `@/*` alias; Tailwind v4 (web UI only — Word styling uses `docx` primitives); Vitest node env (`tests/**/*.test.ts`, `src/**/*.test.ts`); fixtures imported directly.
- `npm run verify` is the gate; this phase touches the route/bundle, so close on **`npm run verify:full`** (adds `next build`) to catch `docx` bundling regressions.

### Integration Points
- `SnapshotApp` (left pane) → `ExportControls` reads `vm` + selected format → `fetch` POST `/api/export/{pdf|docx}` → blob → anchor download; inline error on failure.
- `POST /api/export/docx` → validate `ReportViewModelSchema` → build `docx` `Document` → `Packer.toBuffer` → `application/vnd.openxmlformats-officedocument.wordprocessingml.document` + `Content-Disposition` filename (D-12/D-13).
- The `.docx` builder consumes `ReportViewModel`; its header gets only the static logo/title/state (rule #2); body rows + hyperlink mirror `ReportPDF`.

</code_context>

<specifics>
## Specific Ideas

- **Export control:** one Download button + a `PDF | DOCX` segmented toggle (PDF default); button label tracks the format (`Download PDF` / `Download DOCX`), `Generating…` in flight (D-01/D-03/D-04). Component = `ExportControls`, replacing `DownloadPdfButton` (D-02).
- **Medicare link label:** "View official CMS profile on Medicare.gov", blue + underlined, in the footer (parity with PDF D-04).
- **Filename:** `<slug(displayName)>-Snapshot.docx`; fallback `<sanitized-ccn>-Snapshot.docx` (D-13).
- **Size guard:** route test asserts `Buffer.byteLength(docxBuffer) < 4_500_000` (DOCX-01 / SC#3).
- Demo/test facility **CCN 686123** (Kendall Lakes, FL) — the live "Download DOCX" must work end-to-end; the opened `.docx` must show the logo header, all 13 fields, all 12 claims rows, and the clickable Medicare link to `.../nursing-home/686123`, matching the preview/PDF.

</specifics>

<deferred>
## Deferred Ideas

- **Shared cross-renderer row-descriptor** — a single source of truth for the 13 + 12 body rows that preview, PDF, and `.docx` all consume, replacing the current hand-written triplication. Real maintainability win now that there are three renderers, but a refactor with its own risk — out of scope for Phase 6 (D-07 hand-ports for parity/low risk). Candidate for a future polish/refactor pass.
- **Star-rating visual cards / charts in the `.docx`** → **Phase 7** (VIZ-01/02). Phase 6 renders ratings + metrics as flat label/value rows.
- **Registered custom/brand font in the `.docx`** → **Phase 7** (with the live-deploy font verification). Phase 6 uses the `docx` default font.
- **Full "Looks Done But Isn't" Vercel smoke checklist + 300ms debounce** → **Phase 7** (its checklist includes the ".docx under 4 MB" verification item).

None of the above is scope creep into Phase 6 — they are downstream polish/refactors on top of this phase's `.docx` export.

</deferred>

---

*Phase: 6-.docx Export*
*Context gathered: 2026-06-19*
