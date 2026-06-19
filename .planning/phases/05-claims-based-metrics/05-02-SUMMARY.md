---
phase: 05-claims-based-metrics
plan: "02"
subsystem: cms-data-layer
tags: [claims-mapper, hospmetric, fetch-claims, fetch-averages, tdd, ssrf, description-match]
dependency_graph:
  requires:
    - "05-01: ClaimsRowSchema, AveragesRowSchema, formatFootnote, dataset constants"
    - "02-01: CmsError, fetchFacility SSRF/timeout pattern"
  provides:
    - "HospMetric interface in types.ts"
    - "joinClaimsAndAverages(claimsRows, nationRow, stateRow) → HospMetric[12]"
    - "METRIC_DEFINITIONS (12 verbatim reference labels in order)"
    - "AVERAGE_COLUMN_DESCRIPTIONS (description-substring key scan map)"
    - "fetchClaimsMeasures(ccn) → ClaimsRow[]"
    - "fetchAverages(state) → { nation: AveragesRow; state: AveragesRow }"
  affects:
    - "05-03: route.ts uses fetchClaimsMeasures + fetchAverages + joinClaimsAndAverages"
    - "05-04: ReportPreview + ReportPDF consume HospMetric[] from view-model"
tech_stack:
  added: []
  patterns:
    - "METRIC_DEFINITIONS: 12-entry const array with verbatim labels + measureCode + source + unit"
    - "AVERAGE_COLUMN_DESCRIPTIONS: measureCode → description-substring for runtime key scan (D-14)"
    - "resolveAverage(): key scan over AveragesRow Object.keys, string coercion to number|null"
    - "Mapper always returns 12 rows — absent facility measure → value null + footnoteCode '' (D-10/SC#5)"
    - "fetchClaimsMeasures: flatMap safeParse drop-invalid pattern (graceful partial)"
    - "fetchAverages: two parallel fetchOneAveragesRow calls via Promise.all"
    - "Both fetchers: AbortSignal.timeout(8000) + CmsError taxonomy + SSRF conditions[0][value] discipline"
key_files:
  created:
    - medelite-report/src/lib/cms/claims-mapper.ts
    - medelite-report/tests/lib/cms/claims-mapper.test.ts
  modified:
    - medelite-report/src/lib/cms/types.ts
    - medelite-report/src/lib/cms/client.ts
    - medelite-report/tests/lib/cms/client.test.ts
decisions:
  - "joinClaimsAndAverages always returns 12 rows — absent measure → value null + footnoteCode '' (not undefined); formatFootnote renders 'Not available'. Mapper never decides whole-section degrade (that is Plan 03's allSettled-rejection decision — D-09/D-10/SC#5)"
  - "AVERAGE_COLUMN_DESCRIPTIONS uses shorter substrings (e.g. 'rehospitalized', 'outpatient_em') not full slugs — matches both the current fixture keys and any future renamed slug that contains the same description prefix (D-14)"
  - "fetchAverages uses two separate Promise.all fetches (one for NATION, one for state) instead of a single IN condition — mirrors the fetchFacility single-value pattern for clarity and matches the existing 8s-timeout model"
  - "footnoteCode on absent facility rows set to '' (empty string) not undefined — allows formatFootnote to return 'Not available' without special-casing the absent case; undefined footnoteCode on average rows (no suppression concept for averages)"
  - "Prettier format:check deviations caught twice (Task 1 + Task 2) — both fixed inline before commit"
metrics:
  duration: "~9 min"
  completed: "2026-06-19"
  tasks_completed: 2
  files_modified: 5
requirements: [CLM-01, CLM-02, CLM-03]
---

# Phase 05 Plan 02: Join + Fetch Layer (HospMetric + joinClaimsAndAverages + sibling fetchers) Summary

**One-liner:** Pure 12-row claims-mapper with description-based average column lookup plus two SSRF/timeout-disciplined sibling fetchers, TDD-tested against captured 686123 fixtures with per-row suppression and graceful-partial coverage.

## What Was Built

Three production layers that Plan 03 (route fan-out) and Plan 04 (render) depend on:

### 1. `HospMetric` interface (types.ts)

Added as a domain type after `FacilityData`. Four fields:
- `label: string` — verbatim reference label (D-04 garbles preserved)
- `value: number | null` — adjusted score or average; null when suppressed or absent
- `unit: "percent" | "rate"` — drives formatter selection at render time (D-12)
- `footnoteCode?: string` — present on facility rows that are suppressed/absent; absent on average rows

No CMS snake_case names appear in this interface (D-14).

### 2. `claims-mapper.ts` — `joinClaimsAndAverages()` (new file)

Pure function: `joinClaimsAndAverages(claimsRows, nationRow, stateRow): HospMetric[]`

Key constructs:
- **`METRIC_DEFINITIONS`** — 12-entry `as const` array with verbatim labels + measureCode + source (`facility`/`nation`/`state`) + unit. The garbles are hardcoded exactly: "STR State National Avg. for Hospitalization" (the word "National" is spurious — means STATE), bare "ED Visit" (means LT ED facility). Order matches the reference template exactly (D-04/D-06).
- **`AVERAGE_COLUMN_DESCRIPTIONS`** — maps measureCode → description substring for runtime `Object.keys` scan over the passthrough `AveragesRow`. Substrings verified against `averages-xcdc.json` fixture (rule #3 / D-14):
  - 521 → `"rehospitalized"` (matches `percentage_of_short_stay_residents_who_were_rehospitalized__1d02`)
  - 522 → `"outpatient_em"` (matches `percentage_of_short_stay_residents_who_had_an_outpatient_em_d911`)
  - 551 → `"hospitalizations_per_1000_longstay"` (matches `number_of_hospitalizations_per_1000_longstay_resident_days`)
  - 552 → `"outpatient_emergency_department_visits_per_1000_l"` (matches `number_of_outpatient_emergency_department_visits_per_1000_l_de9d`)
- **`resolveAverage()`** — private helper that scans `AveragesRow` keys for the description substring, coerces the string value to `number | null` using the same empty-string→null logic as `nullableNum`. A missing/renamed column → `null` (never a crash, T-05-COL).
- **12-row contract** enforced: the mapper always produces 12 `HospMetric` objects regardless of how many claims rows are present. An absent facility measure gets `value: null` + `footnoteCode: ""` (formatFootnote renders "Not available"). Nation/state average rows always carry their independent values — per-row, not per-measure-group, suppression (D-10/SC#5).

### 3. `fetchClaimsMeasures` + `fetchAverages` (client.ts additions)

Both replicate the exact SSRF/timeout/Zod pipeline of `fetchFacility`:

**`fetchClaimsMeasures(ccn)`:**
- URL built from `CMS_BASE_URL + DATASET_CLAIMS + "/0"` (fixed constants)
- CCN in `conditions[0][value]` only — never path/host (T-05-V5-SSRF)
- `AbortSignal.timeout(8000)` (T-05-V5-DOS)
- `catch → CmsError("network_error")`, `!resp.ok → CmsError("cms_api_error")`
- Per-row validation via `ClaimsRowSchema.safeParse` inside `flatMap` — invalid rows dropped silently (graceful partial, RESEARCH Pattern 1)
- Returns `[]` for zero results (never throws on empty — route interprets <4 as degraded)

**`fetchAverages(state)`:**
- Two parallel `Promise.all` fetches via private `fetchOneAveragesRow(stateOrNation)` helper
- Fetches `"NATION"` and the given `state` from `DATASET_AVERAGES` filtered by `AVERAGES_FILTER_FIELD`
- No CCN filter — `state`/`"NATION"` only in `conditions[0][value]` (T-05-V5-SSRF)
- Zero rows from either fetch → `CmsError("cms_api_error")` (both rows are required)
- `AveragesRowSchema.safeParse` validates each row; parse failure → `CmsError("cms_api_error")`
- Returns `{ nation: AveragesRow, state: AveragesRow }`

## Tests

| File | New Tests | Approach |
|------|-----------|----------|
| `tests/lib/cms/claims-mapper.test.ts` | 27 cases | CLM-01 (12 rows, verbatim labels, 686123 fixture values), CLM-02 (suppressed + no-footnote cases, per-row D-10), CLM-03 (label order, garbles), D-10/SC#5 (absent measure + empty claims), type contract |
| `tests/lib/cms/client.test.ts` | +15 cases | fetchClaimsMeasures (happy path, drop-invalid, empty, network_error, cms_api_error, SSRF URL, AbortError), fetchAverages (happy path, correct filter field, SSRF, network_error, cms_api_error, zero results, AbortError) |

Total test count: 224 pass (1 skipped — live-API integration test gated by env flag).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed prettier formatting on both new files before commit (Task 1)**
- **Found during:** Running `npm run verify` after Task 1 implementation
- **Issue:** `format:check` failed on `claims-mapper.ts` and `claims-mapper.test.ts` — trailing comma style and function signature line wrapping
- **Fix:** `npx prettier --write` on both files before committing
- **Files modified:** `src/lib/cms/claims-mapper.ts`, `tests/lib/cms/claims-mapper.test.ts`
- **Commit:** `05fd28f`

**2. [Rule 1 - Bug] Fixed prettier formatting on client.test.ts before commit (Task 2)**
- **Found during:** Running `npm run verify` after Task 2 implementation (required two prettier runs — prettier itself left trailing formatting issue after first write)
- **Issue:** `format:check` failed on `tests/lib/cms/client.test.ts` — import statement formatting
- **Fix:** `npx prettier --write` twice on the file
- **Files modified:** `tests/lib/cms/client.test.ts`
- **Commit:** `c143acc`

### Design Refinement (Not a Deviation — clarification during implementation)

The plan's 05-PATTERNS.md showed `joinClaimsAndAverages` with a possible `HospMetric[] | undefined` return type for fewer-than-4 cases. Per the locked D-10/SC#5 decision and the RESEARCH.md Open Question 1 resolution, the mapper always returns `HospMetric[]` (never `undefined`). The `undefined` return was the OLD/SUPERSEDED recommendation. The implementation follows the RESOLVED decision: always 12 rows, partial claims → per-row null, whole-section degrade is the route's decision. This matches the plan's `<behavior>` and `<done>` criteria exactly.

## TDD Gate Compliance

Plan has `tdd="true"` on Task 1. Gate sequence:

- **RED:** Created `tests/lib/cms/claims-mapper.test.ts` (27 tests) importing `joinClaimsAndAverages` from non-existent module → `Cannot find package '@/lib/cms/claims-mapper'` — RED gate confirmed.
- **GREEN:** Created `claims-mapper.ts` with `HospMetric` in `types.ts` → 27 tests pass. GREEN gate confirmed.
- **REFACTOR:** None required — implementation was clean.

Task 2 follows the same approach as the existing `fetchFacility` pattern (no TDD flag — implementation first, tests extended).

## Known Stubs

None. All produced exports are fully implemented and tested. No placeholder values, hardcoded empty arrays, or TODO comments in produced files. The `joinClaimsAndAverages` mapper and both fetchers are complete and production-ready for Plan 03 integration.

## Threat Flags

None beyond what the plan's threat model covers:
- T-05-V5-SSRF: mitigated — CCN/state only in `conditions[0][value]` in both new fetchers
- T-05-V5-DOS: mitigated — `AbortSignal.timeout(8000)` on all fetch calls
- T-05-COL: mitigated — `resolveAverage()` re-coerces matched value to number|null; missing column → null, never crash or fabricated number

## Quality Gate

`npm run verify` green: typecheck PASS, lint PASS, format:check PASS, test PASS (224 tests, 1 skipped).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 (HospMetric + mapper) | `05fd28f` | feat(05-02): add HospMetric type + joinClaimsAndAverages mapper (CLM-01/02/03) |
| Task 2 (sibling fetchers) | `c143acc` | feat(05-02): add fetchClaimsMeasures + fetchAverages to client.ts (CLM-01) |

## Self-Check: PASSED

- `medelite-report/src/lib/cms/claims-mapper.ts` exports `joinClaimsAndAverages` — FOUND
- `medelite-report/src/lib/cms/types.ts` exports `interface HospMetric` — FOUND
- `medelite-report/src/lib/cms/client.ts` exports `fetchClaimsMeasures` + `fetchAverages` — FOUND
- `medelite-report/tests/lib/cms/claims-mapper.test.ts` exists with 27 tests — FOUND
- `medelite-report/tests/lib/cms/client.test.ts` includes fetchClaimsMeasures + fetchAverages blocks — FOUND
- Commits `05fd28f` and `c143acc` exist in git log — VERIFIED
- `npm run verify` green — VERIFIED (224/225 tests pass, 1 skipped)
