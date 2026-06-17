---
phase: 02-api-routes-view-model-config
plan: "01"
subsystem: cms-contract-foundation
tags: [constants, types, errors, zod, discriminated-union, tdd]
dependency_graph:
  requires: [medelite-report/src/lib/cms/schema.ts, medelite-report/tests/fixtures/provider-686123.json]
  provides: [medelite-report/src/lib/cms/constants.ts, medelite-report/src/lib/cms/types.ts, medelite-report/src/lib/cms/errors.ts]
  affects: [02-02, 02-03]
tech_stack:
  added: []
  patterns: [zod-discriminated-union, camelCase-boundary, assertNever-exhaustiveness, tdd-red-green]
key_files:
  created:
    - medelite-report/src/lib/cms/constants.ts
    - medelite-report/src/lib/cms/types.ts
    - medelite-report/src/lib/cms/errors.ts
    - medelite-report/tests/lib/cms/errors.test.ts
  modified: []
decisions:
  - "D-14: FacilityData is camelCase-only boundary; no snake_case CMS names re-exported from types.ts"
  - "D-24: CMS_BASE_URL, DATASET_PROVIDER_INFO ('4pq5-n9py'), CCN_FILTER_FIELD ('cms_certification_number_ccn') centralized in constants.ts, traced to fixture"
  - "D-01/D-03: 5-kind discriminated union (CmsApiErrorSchema) + assertNever exhaustiveness guard in errors.ts"
  - "D-18: CmsError class extends Error with kind+message+extra; Object.setPrototypeOf ensures instanceof works across transpilation targets"
  - "D-05: validation_error variant carries NO extra field — only kind+message — enforcing info-leak prevention"
metrics:
  duration: "~8 minutes"
  completed_date: "2026-06-17"
  tasks_completed: 2
  files_created: 4
---

# Phase 02 Plan 01: Contract Foundation (constants, types, errors) Summary

**One-liner:** CMS constants, FacilityData camelCase domain type, and 5-kind Zod discriminated union with CmsError + assertNever exhaustiveness guard.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Centralize CMS constants + FacilityData domain type | 4a44a56 | constants.ts, types.ts |
| 2 | Error taxonomy: discriminated union, CmsError, assertNever (TDD) | 8a7e625 (RED), 5366a2c (GREEN) | errors.ts, errors.test.ts |

## What Was Built

### Task 1: `constants.ts` and `types.ts`

`constants.ts` exports three named constants — all traced to `tests/fixtures/provider-686123.json` and `scripts/capture-fixture.ts` per CLAUDE.md rule #3:
- `CMS_BASE_URL = 'https://data.cms.gov/provider-data/api/1/datastore/query'`
- `DATASET_PROVIDER_INFO = '4pq5-n9py'` — Provider Information dataset
- `CCN_FILTER_FIELD = 'cms_certification_number_ccn'` — NOT `federal_provider_number` (ARCHITECTURE.md had wrong name from memory)

`types.ts` exports the `FacilityData` interface: the camelCase boundary (D-14). Every field has a comment tracing it to its CMS source in the fixture. No snake_case names are re-exported. Key mappings: `providerName <- provider_name` (D-15, not `legal_business_name`), `starRatings.qualityCare <- qm_rating` (D-16, not `longstay_qm_rating`/`shortstay_qm_rating`), address composed without ZIP (DATA-03).

### Task 2: `errors.ts` and `errors.test.ts` (TDD)

**RED:** `errors.test.ts` written first — 14 tests covering all 5 discriminated union kind accept/reject paths, not_found's required ccn field, validation_error's no-extra-field invariant (D-05), CmsError instanceof chain, kind/message/extra properties, .name, and assertNever runtime throw. Tests failed as expected.

**GREEN:** `errors.ts` implemented:
- `CmsApiErrorSchema`: `z.discriminatedUnion('kind', [...])` with exactly 5 variants; not_found carries `ccn: z.string()`, all others carry only `kind+message`; validation_error has no extra field (D-05 T-02-LEAK mitigation).
- `CmsApiError`: `z.infer<typeof CmsApiErrorSchema>` — TypeScript union for exhaustive switch.
- `assertNever(x: never): never`: throws `'Unhandled CmsError kind: ' + JSON.stringify(x)` — a Phase 3 switch default that calls this will produce a compile error if a 6th kind is ever added without a case (D-03 T-02-EXH mitigation).
- `CmsError extends Error`: constructor takes `kind`, `message`, optional `extra: Record<string, unknown>`; sets `this.name = 'CmsError'`; restores prototype chain via `Object.setPrototypeOf` for reliable instanceof across transpilation targets (D-18).

All 14 tests pass. `npm run verify` green (typecheck, lint, format:check, test).

## Deviations from Plan

None — plan executed exactly as written. Prettier formatting fix applied to `errors.test.ts` before the GREEN commit (standard format:check deviation, auto-fixed inline).

## Known Stubs

None — this plan defines pure type contracts and a class. No UI rendering, no data wiring.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced beyond what the plan's threat model covers. The three mitigations are implemented:

| Threat | Status |
|--------|--------|
| T-02-SSRF: URL host+path from constants only | Constants defined; enforced in Plan 02-02 client.ts |
| T-02-LEAK: validation_error no extra field | Implemented — schema has only kind+message |
| T-02-EXH: assertNever exhaustiveness | Implemented — throws + compile error |
| T-02-SC: no new packages | Confirmed — zero npm installs in this plan |

## Self-Check: PASSED

Files created:
- medelite-report/src/lib/cms/constants.ts — FOUND
- medelite-report/src/lib/cms/types.ts — FOUND
- medelite-report/src/lib/cms/errors.ts — FOUND
- medelite-report/tests/lib/cms/errors.test.ts — FOUND

Commits verified:
- 4a44a56 (Task 1: constants + types)
- 8a7e625 (Task 2 RED: failing tests)
- 5366a2c (Task 2 GREEN: errors.ts + formatted test)

`npm run verify` final run: all checks passed (4 test files, 30 tests, 1 skipped).
