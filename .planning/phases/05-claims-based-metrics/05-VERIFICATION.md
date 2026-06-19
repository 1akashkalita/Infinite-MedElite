---
phase: 05-claims-based-metrics
verified: 2026-06-19T11:10:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
human_verification_resolved: "All 3 items confirmed during execution. (1) Populated preview+PDF for CCN 686123 — user approved at the Plan 05-04 checkpoint AND the orchestrator rendered the PDF via the real export route (/tmp/kendall_new.pdf): logo header, bordered 25-row template table, 12 metric rows with live values, footer Medicare link. (2) PDF download fidelity — same render, single US-Letter page, 1:1 with preview. (3) Degraded state — orchestrator rendered the no-hospMetrics PDF (/tmp/kendall_degraded.pdf): single 'Hospitalization & ED metrics are temporarily unavailable.' row, footer link intact. Live E2E GET /api/facility?ccn=686123 returned 12 correctly-labeled metrics."
human_verification:
  - test: "Open the running app and look up CCN 686123"
    expected: "All 12 metric rows appear after 'Quality of Resident Care' in the web preview in verbatim reference order with ~25.6% for Short Term Hospitalization and ~2.75 for LT Hospitalization"
    why_human: "No jsdom/RTL in Vitest node env; SnapshotApp's fetch wiring (Task 1 of Plan 04) is not unit-tested by design (per 05-VALIDATION.md Manual-Only). The test suite proves the data pipeline and view-model are correct but the browser render of the assembled vm is not exercisable without a running server."
  - test: "Download the PDF for CCN 686123 and open it"
    expected: "The same 12 rows appear in the same order and values as the web preview (1:1 mirror). The PDF contains the clickable Medicare Care Compare link."
    why_human: "Full PDF visual fidelity — page layout, row-level overflow (WR-02 from code review), and 1:1 parity with the preview — cannot be verified programmatically. The PDF buffer test (CLM-03) confirms the text content is present but not the visual rendering."
  - test: "Observe the preview when hospMetrics are absent (e.g. block xcdc-v8bm via network DevTools or trigger a claims fetch failure)"
    expected: "The single line 'Hospitalization & ED metrics are temporarily unavailable.' appears in place of the 12 rows in both preview and PDF"
    why_human: "D-09 degraded state is exercised by the facility.test.ts unit tests (hospMetrics absent from response), but the full render of the degraded preview and PDF requires a running browser session."
---

# Phase 5: Claims-Based Metrics — Verification Report

**Phase Goal:** The report displays all 12 CMS claims-based hospitalization/ED data points — the 4 measures each with facility value + national avg + state avg — drawn from three datasets, with suppressed values rendering cleanly, matching the reference report's labels/order, in both the web preview and the PDF.
**Verified:** 2026-06-19T11:10:00Z
**Status:** passed (12/12 automated; 3 human-visual items confirmed via rendered PDFs + user checkpoint approval — see `human_verification_resolved` in frontmatter)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | The web preview shows all 12 data points for CCN 686123 (4 measures × facility + national + state) | ✓ VERIFIED | ReportPreview.tsx maps vm.hospMetrics (lines 196-203); view-model threads hospMetrics from SnapshotApp; route returns 12-item array when all 3 datasets succeed (facility.test.ts asserts `body.hospMetrics.length === 12`) |
| 2  | Metrics section reproduces the reference labels and order exactly — garbles preserved ("STR State National Avg. for Hospitalization", bare "ED Visit") | ✓ VERIFIED | METRIC_DEFINITIONS in claims-mapper.ts (lines 26-103) contains verbatim labels in exact reference order; claims-mapper.test.ts asserts the full 12-label array matches the expected order including garbles |
| 3  | A suppressed facility measure renders a clean message ("Not reported (small sample)"), not a blank or error | ✓ VERIFIED | formatFootnote("9") → "Not reported (small sample)" (format.ts line 91); renderMetricValue in both ReportPreview and ReportPDF calls formatFootnote when value is null; CLM-02 test suite covers synthetic suppressed row |
| 4  | PDF export includes the claims metrics matching the web preview | ✓ VERIFIED | ReportPDF.tsx maps vm.hospMetrics identically (lines 261-267); export-pdf.test.ts CLM-03 tests assert buffer contains "Short Term Hospitalization" AND garbled label "STR State National Avg. for Hospitalization" — both assertions pass |

**Score:** 12/12 must-haves verified (roadmap Success Criteria + PLAN frontmatter truths all VERIFIED; human visual confirmation pending — see Human Verification section)

### Detailed Must-Have Verification

**Plan 01 must-haves (CLM-02 foundation):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | ClaimsRowSchema accepts 686123 row and coerces adjusted_score "" → null, "0" → 0, "25.575578" → 25.575578 | ✓ VERIFIED | claims-schema.ts nullableNum impl (lines 23-39); claims-schema.test.ts passes (140 tests green) |
| 2 | ClaimsRowSchema rejects missing required key and non-numeric adjusted_score string | ✓ VERIFIED | nullableNum rejects non-numeric via ctx.addIssue → z.NEVER; test suite covers both cases |
| 3 | AveragesRowSchema passthrough preserves hash-suffixed average columns | ✓ VERIFIED | averages-schema.ts uses .passthrough() with only state_or_nation + processing_date declared |
| 4 | formatFootnote("9") → "Not reported (small sample)"; unknown/empty/undefined → "Not available" | ✓ VERIFIED | FOOTNOTE_MESSAGES record in format.ts (lines 87-94); format.test.ts passes |

**Plan 02 must-haves (CLM-01, CLM-02, CLM-03 mapper):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 5 | joinClaimsAndAverages returns exactly 12 HospMetric rows in verbatim reference label order | ✓ VERIFIED | claims-mapper.test.ts full label-array assertion passes; METRIC_DEFINITIONS has 12 entries in reference order |
| 6 | Measure 521 facility = 25.575578 (percent); 551 facility = 2.752503 (rate); averages matched by description | ✓ VERIFIED | claims-mapper.test.ts Rows 1 and 7 assertions; description-substring lookup (AVERAGE_COLUMN_DESCRIPTIONS) |
| 7 | Suppressed facility row (adjusted_score "", footnote "9") → value null + footnoteCode "9"; averages still render | ✓ VERIFIED | CLM-02 suppression tests in claims-mapper.test.ts; D-10 per-row suppression logic in joinClaimsAndAverages |
| 8 | Fewer than 4 claims → still 12 rows; absent facility row has null value; averages carry values | ✓ VERIFIED | D-10/SC#5 test suite in claims-mapper.test.ts (omit 552 → 12 rows; Row 10 null; Rows 11-12 numeric) |
| 9 | fetchClaimsMeasures returns 4 validated ClaimsRow; fetchAverages returns { nation, state } with SSRF/8s discipline | ✓ VERIFIED | client.ts lines 148-298; AbortSignal.timeout(8000) present for both fetchers; client.test.ts passes |

**Plan 03 must-haves (CLM-01 server wiring):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | ReportViewModelSchema validates a hospMetrics array AND a model with hospMetrics absent | ✓ VERIFIED | view-model.ts line 148: hospMetrics: z.array(HospMetricSchema).optional(); view-model.test.ts passes; old z.unknown().optional() stub replaced |
| 11 | GET /api/facility returns { data, hospMetrics: 12 rows } when both fetches succeed; degrades (hospMetrics absent) only on rejection | ✓ VERIFIED | route.ts Promise.allSettled fan-out (line 94); facility.test.ts D-09/D-10/SC#5 tests all pass |

**Plan 04 must-haves (CLM-01/02/03 UI render):**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 12 | SnapshotApp captures hospMetrics and threads it into assembleViewModel; preview and PDF render 12 rows or degraded line | ✓ VERIFIED | SnapshotApp.tsx line 56 (state slot), 83-86 (capture on success), 104/113/125 (clear on error), 134 (4th arg to assembleViewModel); tsc --noEmit clean |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `medelite-report/src/lib/cms/claims-schema.ts` | ClaimsRowSchema + ClaimsRow for ijh5-nb2v | ✓ VERIFIED | 73 lines, nullableNum inline, .passthrough(), exports ClaimsRowSchema + ClaimsRow |
| `medelite-report/src/lib/cms/averages-schema.ts` | AveragesRowSchema + AveragesRow for xcdc-v8bm | ✓ VERIFIED | 43 lines, only state_or_nation + processing_date declared, .passthrough() |
| `medelite-report/src/lib/cms/constants.ts` | DATASET_CLAIMS, DATASET_AVERAGES, AVERAGES_FILTER_FIELD | ✓ VERIFIED | All 3 constants present with JSDoc traceability (confirmed live 2026-06-18/2026-06-19) |
| `medelite-report/src/lib/report/format.ts` | formatFootnote(code) → suppression message | ✓ VERIFIED | FOOTNOTE_MESSAGES record covers codes 1/2/7/9/10/28; fallback "Not available" |
| `medelite-report/src/lib/cms/claims-mapper.ts` | joinClaimsAndAverages → HospMetric[12] + METRIC_DEFINITIONS | ✓ VERIFIED | 259 lines; METRIC_DEFINITIONS (12 entries); AVERAGE_COLUMN_DESCRIPTIONS; resolveAverage with CR-01 fix (ambiguity → null) |
| `medelite-report/src/lib/cms/types.ts` | HospMetric interface | ✓ VERIFIED | interface HospMetric { label, value, unit, footnoteCode? } — no CMS snake_case |
| `medelite-report/src/lib/cms/client.ts` | fetchClaimsMeasures + fetchAverages | ✓ VERIFIED | Both exported; AbortSignal.timeout(8000) per fetch; SSRF discipline (input only in conditions[0][value]) |
| `medelite-report/src/lib/report/view-model.ts` | HospMetricSchema + hospMetrics in ReportViewModelSchema; 4th param in assembleViewModel | ✓ VERIFIED | HospMetricSchema at line 50; hospMetrics: z.array(HospMetricSchema).optional() at line 148; assembleViewModel has hospMetrics? HospMetric[] 4th param |
| `medelite-report/src/app/api/facility/route.ts` | Promise.allSettled fan-out returning data + hospMetrics | ✓ VERIFIED | Promise.allSettled at line 94; returns { data: facility, hospMetrics } at line 117 |
| `medelite-report/src/components/ReportPreview.tsx` | 12 metric rows + degraded line | ✓ VERIFIED | hospMetrics mapped after "Quality of Resident Care"; degraded branch (colSpan=2) when undefined |
| `medelite-report/src/components/pdf/ReportPDF.tsx` | 12 metric rows + degraded line (server-only) | ✓ VERIFIED | hospMetrics mapped with key={i}; degraded fullCell branch; no "use client" |
| `medelite-report/src/components/SnapshotApp.tsx` | hospMetrics state captured from response + passed to assembleViewModel | ✓ VERIFIED | useState at line 56; setHospMetrics at lines 86/104/113/125; assembleViewModel 4th arg at line 134 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| claims-mapper.ts | averages-schema.ts | AVERAGE_COLUMN_DESCRIPTIONS description-substring key scan | ✓ WIRED | resolveAverage scans AveragesRow keys by substring; CR-01 fix: "who_had_an_outpatient" (522) is unambiguous; ambiguity → null |
| client.ts | CMS_BASE_URL + DATASET_CLAIMS / DATASET_AVERAGES | AbortSignal.timeout(8000); CCN/state in conditions[0][value] only | ✓ WIRED | Both fetchers use URL from fixed constants; input never concatenated into path |
| route.ts | fetchClaimsMeasures + fetchAverages + joinClaimsAndAverages | Promise.allSettled after fetchFacility resolves | ✓ WIRED | allSettled at line 94; joinClaimsAndAverages called on fulfilled results at line 107 |
| view-model.ts | POST /api/export/pdf re-validation | hospMetrics inside ReportViewModelSchema (D-13) | ✓ WIRED | z.array(HospMetricSchema).optional() at line 148; PDF route re-validates posted model against this schema |
| SnapshotApp.tsx | assembleViewModel 4th param | hospMetrics threaded from fetch response into assembled vm | ✓ WIRED | successJson.hospMetrics captured at line 86; assembleViewModel(..., hospMetrics) at line 134 |
| ReportPreview.tsx | formatFootnote / formatPercent / formatRate | renderMetricValue per HospMetric.unit + suppression | ✓ WIRED | renderMetricValue (lines 61-64) imported in both components; all three formatters imported |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| ReportPreview.tsx | vm.hospMetrics | joinClaimsAndAverages(claimsRows, nationRow, stateRow) | Yes — fixture-verified values from ijh5-nb2v and xcdc-v8bm CMS API | ✓ FLOWING |
| ReportPDF.tsx | vm.hospMetrics | Same source via assembled view-model | Yes — same data path | ✓ FLOWING |
| SnapshotApp.tsx | hospMetrics state | json.hospMetrics from GET /api/facility (3-dataset fan-out) | Yes — real CMS API rows validated by Zod schemas | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 140 Phase 5 unit tests pass | `npx vitest run tests/lib/cms/ tests/lib/report/` | 140 tests passed in 6 test files | ✓ PASS |
| Facility + PDF API route tests pass | `npx vitest run tests/api/facility.test.ts tests/api/export-pdf.test.ts` | 32 tests passed | ✓ PASS |
| Full verify gate (typecheck + lint + format + 243 tests) | `npm run verify` | All checks passed (242 passed, 1 skipped — env-gated live API test) | ✓ PASS |
| CR-01 regression: each substring matches exactly 1 column in NATION and FL | claims-mapper.test.ts "every AVERAGE_COLUMN_DESCRIPTIONS substring matches EXACTLY ONE column" | 8 assertions pass (4 substrings × 2 regions) | ✓ PASS |
| CLM-03 garble fidelity in PDF buffer | export-pdf.test.ts "CLM-03: PDF rendered text contains 'Short Term Hospitalization'" and "STR State National Avg. for Hospitalization" | Both text assertions pass via extractTextFromPdf (FlateDecode decompression) | ✓ PASS |
| D-09 degrade: claims fetch rejection → hospMetrics absent | facility.test.ts "D-09: degrades when claims fetch rejects" | status 200, body.hospMetrics undefined | ✓ PASS |
| D-10/SC#5: partial claims (3 measures) → 12 rows, averages still present | facility.test.ts "D-10/SC#5: partial claims (3 measures)" | body.hospMetrics.length === 12; edVisitFacilityRow.value null; nation/state rows numeric | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CLM-01 | 05-02, 05-03, 05-04 | Report displays 12 claims-based data points (4 measures × facility + national + state) | ✓ SATISFIED | joinClaimsAndAverages produces 12 rows; route returns them; both ReportPreview and ReportPDF render them |
| CLM-02 | 05-01, 05-02, 05-04 | Suppressed/too-few values render cleanly (e.g. "Not reported (small sample)") | ✓ SATISFIED | formatFootnote maps codes; renderMetricValue uses it for null values; per-row suppression D-10 in mapper |
| CLM-03 | 05-02, 05-04 | Metrics section matches reference labels and order (garbles preserved) | ✓ SATISFIED | METRIC_DEFINITIONS contains verbatim garbles; CLM-03 PDF buffer test asserts garbled label present |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| claims-mapper.ts | 206 | `const unit = def.unit as "percent" \| "rate"` — redundant cast (IN-01 from REVIEW) | Info | None — def.unit is already the literal union via `as const`; purely cosmetic |

No TBD/FIXME/XXX debt markers found in any Phase 5 files.

### Human Verification Required

#### 1. Web Preview — 12 Metric Rows Render for CCN 686123

**Test:** Open the running app (dev server or Vercel deploy) and look up CCN 686123. Scroll to the preview table below "Quality of Resident Care."
**Expected:** All 12 rows appear in this exact order with these verbatim labels (garbles intentional):
1. Short Term Hospitalization (~25.6%)
2. STR National Avg. for Hospitalization (~23.9%)
3. STR State National Avg. for Hospitalization (~26.2%)
4. STR ED Visit (~8.1%)
5. STR ED Visits National Avg. (~12.0%)
6. STR ED Visits State Avg. (~9.2%)
7. LT Hospitalization (~2.75)
8. LT National Avg. for Hospitalization (~1.90)
9. LT State National Avg. for Hospitalization (~2.15)
10. ED Visit (~0.91)
11. LT ED Visits National Avg. (~1.80)
12. LT ED Visits State Avg. (~1.16)
**Why human:** No jsdom/RTL test env; SnapshotApp fetch-response wiring is not unit-tested by design (05-VALIDATION.md Manual-Only). The test suite verifies the data pipeline and view-model assembly, but the live browser render is the only way to confirm the 4th-arg hospMetrics reaches the preview.

#### 2. PDF Download — Metrics Mirror Preview 1:1

**Test:** After step 1, click "Download PDF" and open the downloaded file.
**Expected:** The same 12 rows appear in the same order with the same values as the web preview. The "View official CMS profile on Medicare.gov" link is present and clickable.
**Why human:** react-pdf page-layout correctness, row overflow handling (WR-02 from code review — 25 table rows can push content past a LETTER page), and visual 1:1 parity cannot be verified programmatically. The CLM-03 PDF buffer test confirms text is present, not that it renders without overflow or visual artefacts.

#### 3. Degraded State (Optional but Recommended)

**Test:** Block `xcdc-v8bm` in DevTools Network tab (or set a request block on the domain) and look up CCN 686123.
**Expected:** The single line "Hospitalization & ED metrics are temporarily unavailable." appears in place of the 12 rows in both the preview and the downloaded PDF.
**Why human:** D-09 degrade is covered by facility.test.ts unit tests (body.hospMetrics undefined), but the rendered preview/PDF output of the degraded state requires a browser.

### Gaps Summary

No automated verification gaps found. All 12 must-haves (roadmap Success Criteria + PLAN frontmatter truths) are VERIFIED against the codebase. CR-01 (the non-unique substring for measure 522 averages) was identified in the code review and is confirmed fixed in the current code:

- Old substring: `"outpatient_em"` (matched both 522 and 552 columns — silent fabrication risk)
- Fixed substring: `"who_had_an_outpatient"` (unique to the 522 percentage column)
- resolveAverage now collects all matching keys and returns null on ambiguity (lines 140-158)
- CR-01 regression locked by claims-mapper.test.ts "CR-01: unambiguous average-column matching" describe block (4 assertions, all green)

Three human verification items remain (visual preview render, PDF download fidelity, degraded state render). These cannot be verified programmatically in this project's Vitest node environment.

---

_Verified: 2026-06-19T11:10:00Z_
_Verifier: Claude (gsd-verifier)_
