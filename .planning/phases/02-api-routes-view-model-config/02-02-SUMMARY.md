---
phase: 02-api-routes-view-model-config
plan: "02"
subsystem: cms-fetch-pipeline-and-route
tags: [mapper, client, route-handler, fetch, abort-timeout, zod, error-taxonomy, tdd, security-leak-invariant]
dependency_graph:
  requires:
    - medelite-report/src/lib/cms/constants.ts
    - medelite-report/src/lib/cms/types.ts
    - medelite-report/src/lib/cms/errors.ts
    - medelite-report/src/lib/cms/parse.ts
    - medelite-report/tests/fixtures/provider-686123.json
  provides:
    - medelite-report/src/lib/cms/mapper.ts
    - medelite-report/src/lib/cms/client.ts
    - medelite-report/src/app/api/facility/route.ts
  affects: [03, 04]
tech_stack:
  added: []
  patterns: [pure-mapper, fetch-abort-timeout, exhaustive-switch-assertNever, leak-invariant-test, tdd-red-green, vi-stubGlobal-fetch]
key_files:
  created:
    - medelite-report/src/lib/cms/mapper.ts
    - medelite-report/src/lib/cms/client.ts
    - medelite-report/src/app/api/facility/route.ts
    - medelite-report/tests/lib/cms/mapper.test.ts
    - medelite-report/tests/lib/cms/client.test.ts
    - medelite-report/tests/api/facility.test.ts
  modified: []
decisions:
  - "D-15/NAME-01: toFacilityData maps providerName <- provider_name (operating name, no ', LLC'), deliberately NOT legal_business_name"
  - "D-16/DATA-04: starRatings.qualityCare <- qm_rating (NOT longstay_/shortstay_qm_rating); certifiedBeds <- number_of_certified_beds; address composed with no ZIP (DATA-03)"
  - "D-19/T-02-DOS: fetchFacility uses AbortSignal.timeout(8000) — fail fast under Vercel's ~10s wall, no auto-retry in v1 (D-23)"
  - "D-01/D-18: fetchFacility throws typed CmsError per failure mode (network_error/cms_api_error/not_found/validation_error); route maps each to 400/404/502"
  - "D-05/D-06/T-02-LEAK: validation_error response body is exactly { kind, message } — zero Zod internals; z.prettifyError + CCN go to console.error server-side only"
  - "D-22/T-02-CCN: route gates on /^[A-Za-z0-9]{6}$/ after trim+uppercase, BEFORE any fetch (not ^\\d{6}$ — alphanumeric state codes exist)"
  - "D-03 fix: assertNever receives err.kind (not err) — err is a CmsError class instance, so the switch narrows the discriminant field, not the object, to never in default (exhaustiveness guard preserved)"
metrics:
  duration: "~6 min executor (interrupted) + manual close-out"
  completed_date: "2026-06-17"
  tasks_completed: 3
  files_created: 6
---

# Phase 02 Plan 02: CCN → validated FacilityData JSON over HTTP

**One-liner:** The first demonstrable slice — a pure CMS→domain mapper, the `fetchFacility` pipeline (fetch + 8s abort timeout + Zod validate + map), and the `GET /api/facility` route that gates the CCN and maps every `CmsError` kind to its leak-free HTTP payload.

## Tasks Completed

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 | CMS→domain mapper `toFacilityData` (TDD) | aca2c1e (RED), d42d0e6 (GREEN) | mapper.ts, mapper.test.ts |
| 2 | `fetchFacility` pipeline: fetch + 8s timeout + validate + map (TDD) | bd52bda (RED), ea65460 (GREEN) | client.ts, client.test.ts |
| 3 | `GET /api/facility`: CCN gate + exhaustive CmsError→HTTP mapping (TDD) | de0d628 (RED), 406940b (GREEN), 1d37ebb (style) | route.ts, facility.test.ts |

## What Was Built

### Task 1: `mapper.ts` (TDD)
`toFacilityData(parsed: ParsedProvider): FacilityData` — the single CMS→domain mapping point (D-14). Maps `provider_name` → `providerName` (D-15, deliberately not the `, LLC` legal name), `qm_rating` → `starRatings.qualityCare` (D-16), `number_of_certified_beds` → `certifiedBeds`, address composed from `provider_address`/`citytown`/`state` with **no ZIP** (DATA-03). Tests anchor every value to `provider-686123.json` (providerName === "KENDALL LAKES HEALTHCARE AND REHAB CENTER", qualityCare === 5, certifiedBeds === 150) and assert the output has no snake_case / `zip` keys.

### Task 2: `client.ts` (TDD)
`fetchFacility(ccn): Promise<FacilityData>` runs the full pipeline: URL built from the centralized constants (CCN is only a `conditions[0][value]`, never in host/path — T-02-SSRF), `fetch` with `AbortSignal.timeout(8000)` (D-19). Throws the correct typed `CmsError` for each mode — abort → `network_error`, non-200 → `cms_api_error`, zero rows → `not_found` (with ccn), Zod failure → `validation_error`. The validation_error path `console.error`s the CCN + `z.prettifyError` server-side (D-06) but the thrown message carries no detail (D-05). Tests use `vi.stubGlobal('fetch', ...)` per case and spy on `console.error`.

### Task 3: `route.ts` (TDD)
`export const runtime = 'nodejs'` (D-25); `GET` reads `request.nextUrl.searchParams.get('ccn')` (non-dynamic route — no `ctx.params`), trims + uppercases, and gates on `/^[A-Za-z0-9]{6}$/` **before any fetch** (D-22) — fetch is provably not called for `ccn=12`. On success → 200 `{ data: FacilityData }`; on `CmsError` → exhaustive `switch (err.kind)` mapping to 400/404/502 with `default: assertNever(err.kind)`. The **D-05 leak invariant** is enforced by a test asserting the validation_error body matches none of `/issues|expected|received|path|code/`.

`npm run verify` green: typecheck, lint, format:check, test (58 passed, 1 skipped).

## Deviations from Plan

**Execution was interrupted by a session limit during Task 3, then closed out by the orchestrator.** The executor agent completed Tasks 1–2 fully (committed RED+GREEN) and Task 3's RED tests (de0d628), and had written `route.ts` (the GREEN implementation) on disk but **uncommitted** when the session limit hit — no final verify, no SUMMARY, no STATE/ROADMAP update. The orchestrator closed it out per the workflow's `safe_resume_gate` "close out manually" path:

1. **Found a real typecheck failure** the executor never reached: `route.ts` called `assertNever(err)` where `err` is a `CmsError` *class instance*. Switching on `err.kind` narrows the discriminant field — not the object — so `err` stayed typed `CmsError` (≠ `never`) in `default`. Fixed to `assertNever(err.kind)`, which narrows to `never` and preserves the D-03 compile-time exhaustiveness guard. (Commit 406940b.)
2. **Formatted the RED-committed test files** (mapper/client/facility `.test.ts`) — they had been committed unformatted because the repo has no pre-commit hook to auto-format; format:check failed until fixed. Format-only, no assertions changed. (Commit 1d37ebb.)
3. Ran `npm run verify` to green, then wrote this SUMMARY and updated STATE/ROADMAP.

No plan behavior was altered — all three tasks deliver exactly what the plan specified; the fix corrected an exhaustiveness idiom and the format pass was cosmetic.

## Known Stubs

None in this slice. (The `POST /api/export/pdf` stub belongs to Plan 02-03.)

## Threat Flags

| Threat | Status |
|--------|--------|
| T-02-CCN: trim+uppercase + `/^[A-Za-z0-9]{6}$/` gate before fetch | Implemented + tested (fetch-not-called assertions) |
| T-02-SSRF: host/path from constants, CCN only a condition value | Implemented |
| T-02-LEAK: validation_error body has zero Zod internals (D-05) | Implemented + tested (leak-invariant regex) |
| T-02-DOS: `AbortSignal.timeout(8000)` → clean network_error | Implemented + tested (abort stub) |
| T-02-VAL: `safeParseCMSRow` validates before mapping | Implemented + tested (malformed-row → validation_error) |
| T-02-SC: no new packages | Confirmed — zero npm installs |

## Self-Check: PASSED

Files created:
- medelite-report/src/lib/cms/mapper.ts — FOUND
- medelite-report/src/lib/cms/client.ts — FOUND
- medelite-report/src/app/api/facility/route.ts — FOUND
- medelite-report/tests/lib/cms/mapper.test.ts — FOUND
- medelite-report/tests/lib/cms/client.test.ts — FOUND
- medelite-report/tests/api/facility.test.ts — FOUND

Commits verified: aca2c1e, d42d0e6, bd52bda, ea65460, de0d628, 406940b, 1d37ebb

`npm run verify` final run: all checks passed (7 test files, 58 tests, 1 skipped).
