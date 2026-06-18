---
phase: 04-pdf-export
verified: 2026-06-18T08:45:00Z
status: human_needed
score: 5/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Click Download PDF in the browser for CCN 686123, open the downloaded file in a PDF viewer"
    expected: "Static header reads 'INFINITE — Managed by MEDELITE' / 'FACILITY ASSESSMENT SNAPSHOT' / 'FL'; facility name appears only in body under 'Name of Facility'; all 13 fields render with correct values; clicking 'View official CMS profile on Medicare.gov' opens https://www.medicare.gov/care-compare/details/nursing-home/686123 in a browser"
    why_human: "PDF page text content is FlateDecode-compressed — automated buffer scan cannot confirm rendered header strings or visual layout. Browser download behavior (direct download vs redirect, filename slug) and PDF viewer link click cannot be asserted by Vitest."
  - test: "With CCN 686123 loaded, fill in all manual fields (EMR, Current Census, Type of Patient, Medical Coverage, Previous Provider Performance, Previous Coverage from Medelite), click Download PDF, compare downloaded PDF side-by-side with web preview"
    expected: "PDF content matches the live web preview exactly — same field values, same N/A for null ratings, same dash (—) for blank manual fields"
    why_human: "Cross-output consistency between the web preview and PDF requires human visual inspection; automated tests verify the route returns valid PDF bytes but cannot confirm field-value parity between preview and exported document."
  - test: "Test the 'Generating…' disabled-button state by throttling network to Slow 3G in DevTools, click Download PDF"
    expected: "Button immediately disables and label changes to 'Generating…' for the duration of the request, then re-enables with 'Download PDF' after the file downloads"
    why_human: "Button state transitions during in-flight requests require real browser interaction; cannot be asserted via unit tests."
  - test: "Test the D-08 inline error by temporarily disconnecting from the network or pointing the POST at a broken endpoint, then clicking Download PDF"
    expected: "A small red inline message 'Couldn't generate PDF — try again.' appears below the button; the button remains enabled for retry; no ErrorBanner appears at the top"
    why_human: "Error UX behavior (inline vs banner placement, retry enablement) requires live browser interaction."
---

# Phase 04: PDF Export Verification Report

**Phase Goal:** A user can click "Download PDF" and receive a clean, print-ready PDF generated server-side with @react-pdf/renderer, containing the static branding header, all report data, and a clickable Medicare link — verified in an actual PDF viewer, not just the web preview.
**Verified:** 2026-06-18T08:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | POST /api/export/pdf with a valid ReportViewModel returns 200 with application/pdf body | VERIFIED | `route.tsx` returns `new Response(new Uint8Array(pdfBuffer), { status: 200, headers: { "Content-Type": "application/pdf" } })`. Route test SC#5 asserts 200 + `application/pdf`. 21/21 tests pass. |
| 2 | PDF buffer contains exact static header (INFINITE — Managed by MEDELITE / FACILITY ASSESSMENT SNAPSHOT / state) with facility name only in body | VERIFIED | `ReportPDF.tsx` header `<View>` references only `vm.header.platformLine`, `vm.header.reportTitle`, `vm.header.stateLine` — `displayName` is absent from the header section. Source-level assertion confirmed. Buffer test uses `Helvetica-Bold` font resource presence + `KENDALL LAKES` in Document Title metadata as proxy (page content is FlateDecode-compressed). Full visual confirmation requires human PDF viewer check. |
| 3 | PDF includes clickable hyperlink to https://www.medicare.gov/care-compare/details/nursing-home/{CCN} | VERIFIED | `ReportPDF.tsx:271` uses `<Link src={vm.facility.careCompareUrl}>` with label "View official CMS profile on Medicare.gov". Route test asserts the exact URL string appears in the raw PDF buffer (annotation dictionaries are uncompressed). Buffer assertion passes for CCN 686123. |
| 4 | Content-Disposition is `attachment; filename=<slug(displayName)>-Snapshot.pdf` with CCN fallback | VERIFIED | `route.tsx:66-74` computes `filename = slugFilename(...)` and sets `Content-Disposition: attachment; filename="${filename}"`. `slug.ts` sanitizes both `displayName` (non-`[a-z0-9]` → hyphen) and CCN (non-`[A-Za-z0-9]` stripped, CR-01 fix confirmed in commit 5b3d9aa). Route test asserts `attachment` and `kendall-lakes` in Content-Disposition. |
| 5 | npm run verify:full is green (tests, typecheck, lint, format, next build) | VERIFIED | `npm run verify` passes: typecheck PASS, lint PASS, format:check PASS, test PASS (159 passed / 1 skipped across 14 test files). `npm run verify:full` was confirmed green in SUMMARY-04-02 after next build confirmed no @react-pdf/renderer client bundle leak. |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `medelite-report/src/lib/report/slug.ts` | Pure `slugFilename(displayName, ccn)` helper (D-06) | VERIFIED | Exists, exports `slugFilename`, no imports. CR-01 fix present: CCN sanitized to `[A-Za-z0-9]` at line 48. |
| `medelite-report/tests/lib/slug.test.ts` | Unit tests for slug edge cases | VERIFIED | 8 tests covering blank/whitespace/all-special→CCN fallback, normal slug, leading zeros, displayName injection chars (T-04-03), CCN injection chars (CR-01), all-unsafe CCN fallback to `facility-Snapshot.pdf`. |
| `medelite-report/src/components/pdf/ReportPDF.tsx` | react-pdf Document mirroring ReportPreview.tsx | VERIFIED | Exists, exports `ReportPDF`, no `"use client"` directive, `<Page size="LETTER">`, no `Font.register`, 13 body fields in correct verbatim label order, `<Link src={vm.facility.careCompareUrl}>` present, header reads only `vm.header.*`. |
| `medelite-report/src/app/api/export/pdf/route.tsx` | Real renderToBuffer response replacing 501 stub | VERIFIED | Renamed from `.ts` to `.tsx` (JSX support). Contains `renderToBuffer(<ReportPDF vm={parseResult.data} />)`, `slugFilename(`, and `new Response(... "Content-Type": "application/pdf" ... attachment; filename=)`. Both 400 branches preserved. |
| `medelite-report/tests/api/export-pdf.test.ts` | Phase-4 route tests: 200, content-type, content-disposition, URL-in-buffer, header-in-buffer | VERIFIED | 13 tests total: 6 invalid-body 400 tests + 7 Phase-4 real-PDF tests. All pass. File-level comment at line 10 retains stale "Valid ReportViewModel → 501" text and line 83 retains "is RED against 501 stub" (WR-03 from review, advisory only — no live test asserts 501). |
| `medelite-report/src/components/DownloadPdfButton.tsx` | Client download button with D-07 states, D-08 inline error | VERIFIED | Exists, `"use client"` at line 1, exports `DownloadPdfButton`, `disabled={loading \|\| !vm}`, label switches `"Download PDF"` / `"Generating…"`, inline `<p role="alert">` error, no `ErrorBanner` import, no `@react-pdf/renderer` import. WR-02 fix present: `setTimeout(() => URL.revokeObjectURL(url), 0)` at line 71. |
| `medelite-report/src/components/SnapshotApp.tsx` | Mounts DownloadPdfButton in left pane fed assembled vm | VERIFIED | Imports `DownloadPdfButton` at line 36; renders `<DownloadPdfButton vm={vm} />` at line 174, after `<ManualInputsForm>`. No server-only imports added. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `route.tsx` | `ReportPDF.tsx` | `renderToBuffer(<ReportPDF vm={parseResult.data} />)` | WIRED | Confirmed at route.tsx:15-16 imports + line 65 usage. |
| `route.tsx` | `slug.ts` | `slugFilename(parseResult.data.facility.displayName, parseResult.data.facility.ccn)` | WIRED | Confirmed at route.tsx:17 import + lines 66-69 usage. |
| `ReportPDF.tsx` | `vm.facility.careCompareUrl` | `<Link src={vm.facility.careCompareUrl}>` | WIRED | Confirmed at ReportPDF.tsx:271. URL never reconstructed in this file. |
| `SnapshotApp.tsx` | `DownloadPdfButton.tsx` | `<DownloadPdfButton vm={vm} />` | WIRED | Confirmed at SnapshotApp.tsx:36 import + line 174 render. |
| `DownloadPdfButton.tsx` | `/api/export/pdf` | `fetch("/api/export/pdf", { method: "POST", ... }) → resp.blob() → URL.createObjectURL → <a download>` | WIRED | Confirmed at DownloadPdfButton.tsx:51-66. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `ReportPDF.tsx` | `vm` prop | `route.tsx` → `parseResult.data` from `ReportViewModelSchema.safeParse(body)` | Yes — validated ReportViewModel from POST body; route test uses real fixture-derived vm | FLOWING |
| `DownloadPdfButton.tsx` | `vm` prop | `SnapshotApp.tsx` → `assembleViewModel(facilityData, manualInputs, new Date())` | Yes — `facilityData` comes from live CMS fetch via `/api/facility` | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Route returns 200 + application/pdf for valid body | `npx vitest run tests/api/export-pdf.test.ts` | 13 tests pass, 0 fail | PASS |
| Slug helper edge cases | `npx vitest run tests/lib/slug.test.ts` | 8 tests pass | PASS |
| Full verify gate | `npm run verify` | 159 passed / 1 skipped, all checks PASS | PASS |

### Probe Execution

No probe scripts detected in `scripts/*/tests/probe-*.sh`. Step 7c: SKIPPED (no probe files present).

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PDF-01 | 04-01 + 04-02 | User can click "Download PDF" to trigger a direct browser download of a clean, print-ready PDF built with `@react-pdf/renderer` | SATISFIED | Route returns 200 application/pdf (plan 01); DownloadPdfButton wires click→fetch→blob→anchor-download (plan 02). `next build` green confirms @react-pdf/renderer server-side only. |
| PDF-02 | 04-01 | PDF includes a clickable hyperlink to the Medicare Care Compare URL | SATISFIED | `<Link src={vm.facility.careCompareUrl}>` in ReportPDF.tsx; buffer test asserts URL is present in annotation dict. |
| PDF-03 | 04-01 | Downloaded PDF content matches what the live preview showed | SATISFIED (automated partial) | ReportPDF.tsx mirrors ReportPreview.tsx 1:1 — same 13-field verbatim label order, same formatters, same null→N/A/dash semantics. Full visual parity requires human check (see Human Verification). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/api/export-pdf.test.ts` | 10 | Stale comment: "Valid ReportViewModel → 501 `{ error: { kind: 'not_implemented' } }`" | Info (WR-03) | No live assertion expects 501; comment is misleading documentation only. Non-blocking. |
| `tests/api/export-pdf.test.ts` | 83 | Stale comment: "This describe block is RED against the current 501 stub" | Info (WR-03) | Same as above — no functional impact. The tests pass green. Non-blocking. |
| `src/components/DownloadPdfButton.tsx` | 64 | `a.download = "report.pdf"` — static hint that may win over server Content-Disposition on blob URLs | Info (IN-03) | User receives `report.pdf` rather than `kendall-lakes-...-Snapshot.pdf`. Cosmetic only; no correctness defect. |

No `TBD`, `FIXME`, or `XXX` debt markers found in any phase-modified file.

No empty implementations (`return null`, `return {}`, `return []`) found in phase-modified source files.

### Human Verification Required

#### 1. PDF viewer content and header check

**Test:** With the app running (CCN 686123 loaded), click "Download PDF". Open the downloaded file in a PDF viewer (Preview, Adobe Reader, Chrome's built-in viewer).
**Expected:** Header reads exactly "INFINITE — Managed by MEDELITE" / "FACILITY ASSESSMENT SNAPSHOT" / "FL". Facility name "Kendall Lakes Healthcare and Rehab Center" (or override) appears only in the body under "Name of Facility". All 13 fields are populated with expected values. Footer shows CMS processing date.
**Why human:** PDF page content streams are FlateDecode-compressed. Automated buffer scan cannot find the rendered header text strings. Visual layout and font rendering require a real PDF viewer.

#### 2. Clickable Medicare link in PDF viewer

**Test:** In the same downloaded PDF, click "View official CMS profile on Medicare.gov" in the footer.
**Expected:** Browser opens `https://www.medicare.gov/care-compare/details/nursing-home/686123` in a new tab.
**Why human:** PDF link click-through behavior requires a real PDF viewer with URL handling enabled.

#### 3. PDF content matches web preview

**Test:** With CCN 686123 loaded and all manual fields populated, side-by-side compare the web preview and the downloaded PDF.
**Expected:** Every field value is identical between web preview and PDF — including manual inputs, star ratings, location, census capacity, and N/A for any null field.
**Why human:** Cross-output visual parity cannot be asserted by unit tests; requires human comparison.

#### 4. Download button states (D-07)

**Test:** Throttle network to "Slow 3G" in DevTools. Click "Download PDF".
**Expected:** Button immediately disables and shows "Generating…" for the duration. Re-enables with "Download PDF" label after download completes.
**Why human:** Real-time UI state transitions during async requests require browser interaction.

#### 5. Inline error on failure (D-08)

**Test:** Simulate export failure (disable network or temporarily break the route). Click "Download PDF".
**Expected:** Small red message "Couldn't generate PDF — try again." appears below the button. Button stays enabled. No ErrorBanner appears at the top of the page.
**Why human:** Error UX path requires live browser interaction; cannot be asserted via unit tests.

### Gaps Summary

No code gaps found. All 5 must-have truths are VERIFIED by codebase evidence:

- The BLOCKER from code review (CR-01: Content-Disposition header injection via verbatim CCN fallback) was fixed in commit `5b3d9aa` — `slug.ts` now sanitizes the CCN to `[A-Za-z0-9]` and tests cover the injection path.
- The warning from code review (WR-02: synchronous revokeObjectURL) was fixed in the same commit — deferred via `setTimeout`.
- The remaining review findings (WR-01 cross-field URL/CCN check, WR-03 stale comments, IN-01 formatLocation, IN-02 Document title, IN-03 download hint, IN-04 empty catch) are advisory/info and non-blocking for phase goal achievement.

Status is `human_needed` because 5 human verification items cover visual PDF content (FlateDecode-compressed text), link click-through, cross-output parity, and interactive button states — none of which can be asserted programmatically.

---

_Verified: 2026-06-18T08:45:00Z_
_Verifier: Claude (gsd-verifier)_
