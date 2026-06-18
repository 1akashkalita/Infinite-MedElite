---
phase: 03-web-ui-core-flow-deployment
plan: 01
subsystem: ui
tags: [zod, typescript, vitest, ccn, error-handling, view-model]

# Dependency graph
requires:
  - phase: 02-api-routes-view-model-config
    provides: CmsApiError discriminated union + assertNever, ManualInputs interface, ReportViewModelSchema, assembleViewModel

provides:
  - previousProviderPerformance field in ManualInputs, ReportViewModelSchema, assembleViewModel (INPT-01 sixth field)
  - src/lib/ui/ccn.ts — normalizeCcn + isValidCcnFormat mirroring the server gate (LOOK-02)
  - src/lib/ui/error-presentation.ts — exhaustive error-kind → message/placement mapping with assertNever (LOOK-03/ERR-01/ERR-02)
  - tests for all three modules (ccn-precheck.test.ts, error-kind-mapping.test.ts, view-model.test.ts extended)

affects:
  - 03-02 (CCN form component — imports normalizeCcn/isValidCcnFormat from ccn.ts)
  - 03-02 (error display — imports getErrorPresentation/ErrorPlacement from error-presentation.ts)
  - 03-02 (preview — ManualInputs now has previousProviderPerformance)
  - 04 (PDF route — ReportViewModelSchema carries previousProviderPerformance)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure lib modules under src/lib/ui/ — no use client, safe both sides; import via @/lib/ui/* alias"
    - "assertNever(kind) with captured discriminant — avoids TypeScript error when union narrows to never in default arm"
    - "TDD: test file first (RED), then implementation (GREEN), no REFACTOR pass needed"

key-files:
  created:
    - medelite-report/src/lib/ui/ccn.ts
    - medelite-report/src/lib/ui/error-presentation.ts
    - medelite-report/tests/lib/ccn-precheck.test.ts
    - medelite-report/tests/lib/error-kind-mapping.test.ts
  modified:
    - medelite-report/src/lib/report/view-model.ts
    - medelite-report/tests/lib/report/view-model.test.ts

key-decisions:
  - "assertNever receives captured `kind` variable (not `error.kind`) — when the discriminated union exhausts all cases, `error` is narrowed to `never` so `error.kind` is not accessible in the default arm; capturing `const kind = error.kind` before the switch preserves exhaustiveness enforcement"
  - "CCN_REGEX private to ccn.ts module — /^[A-Za-z0-9]{6}$/ mirrors route.ts exactly; comment names route.ts as canonical source (D-05)"
  - "validation_error message uses non-retry copy: 'Received an unexpected response from CMS. This issue has been noted.' — does not say 'try again' (D-08)"

patterns-established:
  - "Pure lib modules under src/lib/ui/ — no use client directive, no side effects, no framework imports"
  - "Exhaustive error switch: capture discriminant before switch to keep default arm type-safe"

requirements-completed: [LOOK-02, LOOK-03, ERR-01, ERR-02, INPT-01]

# Metrics
duration: 12min
completed: 2026-06-17
---

# Phase 3 Plan 01: Foundation Logic Modules Summary

**Pure `src/lib/ui/` modules for CCN pre-check and error-kind mapping plus INPT-01's missing `previousProviderPerformance` field, all with TDD coverage — Phase 3 Wave 0 BLOCKING unblocked**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-17T17:37:00Z
- **Completed:** 2026-06-17T17:41:30Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Extended `ManualInputs`, `ReportViewModelSchema`, and `assembleViewModel` with `previousProviderPerformance` (INPT-01 sixth manual field — was blocking Phase 3 UI work)
- Created `src/lib/ui/ccn.ts` with `normalizeCcn` + `isValidCcnFormat` mirroring the server gate exactly (`/^[A-Za-z0-9]{6}$/`, trim+uppercase), no framework deps (LOOK-02)
- Created `src/lib/ui/error-presentation.ts` with exhaustive 5-kind switch + `assertNever(kind)` compile-time guard; all placements and copy per D-07/D-08 including non-retry `validation_error` (LOOK-03/ERR-01/ERR-02)
- All three test files pass; `npm run verify` is green (typecheck + lint + format:check + test)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend ManualInputs + ReportViewModelSchema** - `4900305` (feat)
2. **Task 2: Create src/lib/ui/ccn.ts + tests** - `f431324` (feat)
3. **Task 3: Create src/lib/ui/error-presentation.ts + tests** - `eb51e7c` (feat)

## Files Created/Modified

- `medelite-report/src/lib/report/view-model.ts` — Added `previousProviderPerformance` to ManualInputs interface, ReportViewModelSchema.manual, and assembleViewModel return
- `medelite-report/tests/lib/report/view-model.test.ts` — Extended manual inputs describe block with previousProviderPerformance round-trip test
- `medelite-report/src/lib/ui/ccn.ts` — New: `normalizeCcn(raw)` + `isValidCcnFormat(ccn)` mirroring server gate
- `medelite-report/tests/lib/ccn-precheck.test.ts` — New: 11 tests covering valid/short/long/special/alphanumeric and trim/uppercase
- `medelite-report/src/lib/ui/error-presentation.ts` — New: `ErrorPlacement` type + `getErrorPresentation(error)` exhaustive mapping
- `medelite-report/tests/lib/error-kind-mapping.test.ts` — New: 6 tests covering all 5 kinds, distinctness, and non-retry assertion

## Decisions Made

- **assertNever receives captured `kind` variable, not `error.kind` directly.** When a TypeScript discriminated union switch exhausts all cases, the whole `error` object is narrowed to `never` in the default arm, making `error.kind` inaccessible. Capturing `const kind = error.kind` before the switch preserves the `never` narrowing on `kind` alone, satisfying `assertNever`'s type requirement. This is the RESEARCH Pitfall 4 mitigation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] assertNever called with captured discriminant, not error.kind directly**
- **Found during:** Task 3 (error-presentation.ts implementation)
- **Issue:** The plan spec said `assertNever(error.kind)` but TypeScript narrowed `error` to `never` in the default arm of the exhaustive switch, making `error.kind` a compile error (`Property 'kind' does not exist on type 'never'`)
- **Fix:** Captured `const kind = error.kind` before the switch, then passed `kind` to `assertNever(kind)` in the default arm — same exhaustiveness enforcement, type-correct
- **Files modified:** `medelite-report/src/lib/ui/error-presentation.ts`
- **Verification:** `npm run verify` passes including typecheck; 6 tests green
- **Committed in:** `eb51e7c` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - type error)
**Impact on plan:** Required for TypeScript correctness. Exhaustiveness guarantee (D-09/ERR-02) is preserved — `assertNever(kind)` is equivalent to `assertNever(error.kind)` since `kind = error.kind`.

## Issues Encountered

None beyond the assertNever deviation above.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 0 BLOCKING resolved: `previousProviderPerformance` is in the view-model
- `src/lib/ui/ccn.ts` and `src/lib/ui/error-presentation.ts` are ready for import by Phase 3 Wave 2 client components (form, error display)
- No blockers for Phase 3 Plan 02

## Known Stubs

None — all modules deliver production-ready pure functions.

## Threat Flags

No new security-relevant surface introduced. All new files are pure lib modules with no network endpoints, no auth paths, no file access, and no schema changes at trust boundaries.

---
*Phase: 03-web-ui-core-flow-deployment*
*Completed: 2026-06-17*
