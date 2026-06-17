---
phase: 01-foundation-cms-data-layer
plan: "03"
subsystem: cms-validation
tags: [zod, schema, validation, tdd, cms-api]
dependency_graph:
  requires: ["01-01", "01-02"]
  provides: ["CMSRowSchema", "ParsedProvider", "parseCMSRow", "safeParseCMSRow"]
  affects: ["Phase 2 /api/facility route handler", "ReportViewModel"]
tech_stack:
  added: []
  patterns:
    - "Zod v4 z.preprocess + z.coerce.number().nullable() for empty→null→coerce pipeline"
    - "Required-key + nullable-value schema (D-05/D-06) for loud missing-field failures"
    - "vitest resolve.alias for @/* path alias in test files"
key_files:
  created:
    - medelite-report/src/lib/cms/schema.ts
    - medelite-report/src/lib/cms/parse.ts
    - medelite-report/tests/lib/cms/schema.test.ts
  modified:
    - medelite-report/vitest.config.ts
decisions:
  - "D-04 (lean schema): .passthrough() on CMSRowSchema so ~90 unmodeled CMS columns are preserved"
  - "D-05/D-06 (required+nullable): depended-on fields are required keys with nullable values — .optional() intentionally omitted so a renamed CMS key fails safeParse loudly"
  - "D-07 (coerce inside schema): numeric strings coerced to numbers at the schema boundary"
  - "D-08 (preprocess before coerce): empty/whitespace → null before z.coerce.number to avoid the z.coerce.number('')=0 trap"
  - "D-09 (real zero preserved): '0' → 0, only empty/whitespace → null"
  - "D-10 (CCN/ZIP as strings): cms_certification_number_ccn and zip_code use z.string() to preserve leading zeros"
  - "D-12 (inline malformed fixtures): missingRequiredKey, suppressedRow, wrongShape defined as inline typed constants in schema.test.ts to avoid JSON type-inference edge case"
  - "Deviation (auto-fix Rule 3): vitest.config.ts updated with resolve.alias for @/* → ./src; tsconfig alias was not forwarded to Vitest automatically"
metrics:
  duration: "~4 minutes"
  completed: "2026-06-17T07:50:34Z"
  tasks_completed: 2
  files_changed: 4
---

# Phase 1 Plan 3: Zod Provider Schema + Parse Module Summary

**One-liner:** Zod v4 CMSRowSchema with empty→null→coerce preprocess pipeline (D-08/D-09) and required-key + nullable-value pattern (D-05/D-06) enforcing loud failures on missing CMS fields (DATA-06).

## What Was Built

### Task 1: Failing test suite (TDD RED)

Created `medelite-report/tests/lib/cms/schema.test.ts` with 8 assertions covering all required DATA-02 behaviors and the DATA-06 schema traceability invariant:

1. Happy-path: `CMSRowSchema.safeParse(providerFixture[0])` succeeds
2. Typed output: fixture parse returns `cms_certification_number_ccn === "686123"`, `typeof overall_rating === "number"`
3. Empty→null: suppressed `overall_rating: ""` yields `null`, not `0` (the D-08 landmine)
4. Zero preserved: `overall_rating: "0"` yields `0` (D-09)
5. Missing-key failure: object without `cms_certification_number_ccn` fails `safeParse`; `result.error.issues.length > 0` (Zod v4 API)
6. Wrong-shape failure: `{ error, message }` object fails `safeParse`
7. Leading-zero preservation: CCN `"056789"` and ZIP `"075001"` survive as strings (D-10)
8. DATA-06 traceability: schema-derived loop over `CMSRowSchema.shape` keys asserts every key exists in `providerFixture[0]`

Suite failed at RED because `@/lib/cms/schema` did not exist yet. Commit: `5a60d15`.

### Task 2: Implementation (TDD GREEN)

**`src/lib/cms/schema.ts`:**
- `nullableNum` helper: `z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? null : v), z.coerce.number().nullable())`
- `CMSRowSchema`: 8 string fields (CCN, ZIP, provider_name, legal_business_name, provider_address, citytown, state, processing_date), `number_of_certified_beds` + 4 star ratings using `nullableNum`, terminated with `.passthrough()`
- All field names verified against `tests/fixtures/provider-686123.json` (CLAUDE.md rule #3)
- `qm_rating` used for Quality of Resident Care (NOT `longstay_qm_rating` / `shortstay_qm_rating`) per CLAUDE.md
- No `.optional()` on any depended-on field — deliberate D-06 refinement of ROADMAP SC#4
- Exports: `CMSRowSchema`, `ParsedProvider`

**`src/lib/cms/parse.ts`:**
- `parseCMSRow(raw: unknown): ParsedProvider` — throws `new Error(z.prettifyError(result.error))` on failure
- `safeParseCMSRow(raw: unknown)` — returns `CMSRowSchema.safeParse(raw)` directly
- Uses `result.error.issues` throughout (Zod v4); no occurrence of `result.error.errors` (undefined in v4)

**`vitest.config.ts`** (deviation auto-fix): Added `resolve.alias` mapping `@` → `./src` so tests importing `@/lib/cms/schema` resolve correctly in Vitest.

Commit: `f57d183`. All 8 tests green, `npm run verify` exits 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@/` path alias not forwarded to Vitest**
- **Found during:** Task 2 (GREEN phase) — first test run attempt
- **Issue:** `vitest.config.ts` had no `resolve.alias`; the `tsconfig.json` `paths` config is used by TypeScript/tsc but not automatically picked up by Vitest's module resolver. Tests importing `@/lib/cms/schema` failed with "Cannot find package" error.
- **Fix:** Added `resolve: { alias: { "@": resolve(__dirname, "./src") } }` to `vitest.config.ts` (standard Vitest configuration pattern).
- **Files modified:** `medelite-report/vitest.config.ts`
- **Commit:** `f57d183`

### Intentional Plan Deviations

**1. D-06: `.optional()` absent on depended-on fields (documented deviation from ROADMAP SC#4 literal wording)**
- ROADMAP SC#4 says "nullable().optional()" — this plan deliberately drops `.optional()` (keeping required-key + nullable-value)
- Reason: CMS suppression is always an empty string with the key present, never a missing key; dropping `.optional()` is what makes a renamed/removed field fail loudly (the DATA-06 invariant)
- Status: Intentional — surfaced in plan objective and CONTEXT.md D-05/D-06

## Known Stubs

None — this plan is pure infrastructure with no UI rendering paths.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced beyond those modeled in the plan's threat register.

All four threat mitigations from the plan's `<threat_model>` are implemented:
- T-03-01: `CMSRowSchema.safeParse` is the single validation boundary; `parseCMSRow` throws `z.prettifyError` on failure
- T-03-02: Required-key + `.nullable()` (no `.optional()`) makes a missing depended-on key fail `safeParse` loudly; DATA-06 test asserts every schema field exists in the fixture
- T-03-03: Empty/whitespace → `null` BEFORE numeric coercion; dedicated test asserts `""` → `null` and `"0"` → `0`
- T-03-04: CCN and ZIP modeled as `z.string()`, never coerced; test asserts `"056789"` survives

## TDD Gate Compliance

- RED commit: `5a60d15` — `test(01-03): add failing CMSRowSchema test suite (RED)`
- GREEN commit: `f57d183` — `feat(01-03): implement CMSRowSchema + parse module (GREEN)`
- No REFACTOR step needed (implementation was clean on first pass)

## Self-Check: PASSED

Files exist:
- `medelite-report/src/lib/cms/schema.ts` — FOUND
- `medelite-report/src/lib/cms/parse.ts` — FOUND
- `medelite-report/tests/lib/cms/schema.test.ts` — FOUND
- `medelite-report/vitest.config.ts` — FOUND (modified)

Commits verified in git log:
- `5a60d15` — test(01-03): RED suite — FOUND
- `f57d183` — feat(01-03): GREEN implementation — FOUND

`npm run verify` exits 0: CONFIRMED
