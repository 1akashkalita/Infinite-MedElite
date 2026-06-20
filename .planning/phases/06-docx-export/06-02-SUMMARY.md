---
phase: "06-docx-export"
plan: "02"
subsystem: "docx-export"
tags: ["docx", "route", "DOCX-01", "D-05", "D-12", "D-13"]
dependency_graph:
  requires:
    - "slugFilename(name, ccn, ext) — 06-01"
    - "buildReportDocx(vm): Document — 06-01"
    - "ReportViewModelSchema — Phase 02"
  provides:
    - "POST /api/export/docx — validates body, builds Word buffer, returns 200 OOXML with OOXML Content-Type + .docx Content-Disposition"
  affects:
    - "medelite-report/src/app/api/export/docx/route.ts"
    - "medelite-report/tests/api/export-docx.test.ts"
tech_stack:
  added:
    - "Packer.toBuffer(doc) — docx v9 — converts Document to Node Buffer"
  patterns:
    - "Clone-the-PDF-route pattern: non-JSON try/catch → ReportViewModelSchema.safeParse → clean 400 → buffer → headers"
    - "new Uint8Array(buffer) cast: Buffer extends Uint8Array at runtime (lossless cast for Web Response API)"
    - "D-05 clean-envelope discipline: NO Zod internals in 400 response body"
    - "export const runtime = 'nodejs' — docx Packer needs Node Buffer/zip"
key_files:
  created:
    - "medelite-report/src/app/api/export/docx/route.ts"
    - "medelite-report/tests/api/export-docx.test.ts"
decisions:
  - "D-12: POST /api/export/docx mirrors the PDF route contract exactly — same validation, same clean-envelope 400, same nodejs runtime"
  - "docx NOT added to serverExternalPackages — pure CJS, no native bindings (06-RESEARCH Q1 confirmed); next.config.ts left unchanged"
  - "new Uint8Array(docxBuffer) cast: matches PDF route line 70 — Buffer extends Uint8Array at runtime"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-20T01:10:00Z"
  tasks: 2
  files: 2
---

# Phase 06 Plan 02: POST /api/export/docx Route Summary

## One-liner

Stood up `POST /api/export/docx` mirroring the Phase-4 PDF route contract — Zod-validated body → `Packer.toBuffer(buildReportDocx(vm))` → 200 OOXML buffer with PK ZIP magic bytes, correct OOXML Content-Type, `.docx` Content-Disposition, and clean 400 on invalid input (all 13 assertions green).

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Wave 0 — write export-docx route test suite (RED) | 082004d | `tests/api/export-docx.test.ts` |
| 2 | Clone PDF route into POST /api/export/docx (GREEN) | 8e8f8e0 | `src/app/api/export/docx/route.ts` |

## What Was Built

### Task 1: export-docx test suite (TDD RED gate)

Created `tests/api/export-docx.test.ts` with 13 test assertions mirroring `export-pdf.test.ts` exactly, adapted for DOCX:

**Invalid body describe (6 tests):**
- Returns 400 for an empty object body
- Returns `kind: 'invalid_request'` for a bad shape
- Error envelope has a message string
- D-05: 400 body does NOT match `/issues|expected|received|path/` (no Zod internals leak)
- Exact envelope shape: outer keys `["error"]`, inner keys `["kind","message"]`
- Non-JSON body → 400 (not raw 500)

**Valid body describe (7 tests):**
- Returns 200 for a valid `ReportViewModel`
- Content-Type contains the OOXML MIME type
- Content-Disposition contains "attachment" and ".docx"
- Content-Disposition contains "kendall-lakes" slug
- Buffer byteLength < `4_500_000` (DOCX-01 SC#3)
- PK ZIP magic bytes: `0x50, 0x4B, 0x03, 0x04` (real OOXML file validation)
- `validVmWithMetrics` → 200 (claims path renders without throwing)

`extractTextFromPdf` was intentionally NOT carried over — the structural DOCX check is the PK magic-bytes assertion.

### Task 2: POST /api/export/docx route (GREEN)

Created `src/app/api/export/docx/route.ts` (`.ts`, not `.tsx` — no JSX):

- `export const runtime = "nodejs"` — docx Packer needs Node Buffer/zip
- Non-JSON try/catch → clean 400 `{ error: { kind: "invalid_request", message: "Invalid report data." } }`
- `ReportViewModelSchema.safeParse(body)` → same clean 400 on failure (D-05: no Zod internals)
- `Packer.toBuffer(buildReportDocx(parseResult.data))` → `new Uint8Array(docxBuffer)` (lossless cast)
- `slugFilename(displayName, ccn, ".docx")` for injection-safe Content-Disposition (D-13)
- `Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `next.config.ts` unchanged — docx is pure CJS, no native bindings (serverExternalPackages not needed)

## Verification

- `cd medelite-report && npx vitest run tests/api/export-docx.test.ts` — 13/13 pass (GREEN)
- `npm run verify` — all 4 checks pass (typecheck + lint + format + 258 tests, 1 skipped)
- `grep -n "serverExternalPackages" next.config.ts` — only `"@react-pdf/renderer"` (docx NOT added)
- `grep -n "^export const runtime" src/app/api/export/docx/route.ts` — line 25: `export const runtime = "nodejs";`

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. The route is fully functional: validates input, builds Word document via `buildReportDocx`, returns real OOXML buffer.

## Threat Surface Scan

`POST /api/export/docx` introduces a new network endpoint — but it is already accounted for in the plan's `<threat_model>`:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-06-04: Tampering via POST body | `ReportViewModelSchema.safeParse` + non-JSON catch → 400 | Implemented |
| T-06-05: Zod internals disclosure | Clean-envelope 400, no `.issues`/`.paths`/`.codes` | Implemented + asserted by test |
| T-06-06: `displayName`/`ccn` → Content-Disposition | Both pass through `slugFilename` (allowlist sanitized in 06-01) | Implemented |
| T-06-08: docx/buildReportDocx reaching client bundle | Imported only by this server route, never client component | Maintained |

## Self-Check: PASSED

- `medelite-report/tests/api/export-docx.test.ts` — exists, created
- `medelite-report/src/app/api/export/docx/route.ts` — exists, created
- Commit `082004d` — found in git log
- Commit `8e8f8e0` — found in git log
