---
phase: 02-api-routes-view-model-config
verified: 2026-06-17T15:55:00Z
status: passed
score: 5/5
overrides_applied: 0
re_verification: null
gaps: []
deferred: []
human_verification: []
---

# Phase 02: API Routes, View Model & Config — Verification Report

**Phase Goal:** The server API surface is complete — a GET `/api/facility` route validates and
proxies CMS data, a POST `/api/export/pdf` stub is in place, the shared `ReportViewModel` type
and `assembleHeader()` function exist, and `npm run verify:full` is green including the
production build.

**Verified:** 2026-06-17T15:55:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `GET /api/facility?ccn=686123` returns 200 with a fully typed `FacilityData` JSON body (name, composed address without ZIP, certified beds, all four star ratings with Quality from `qm_rating`) | VERIFIED | `route.ts` calls `fetchFacility(ccn)` → `toFacilityData(parsed)` → maps `qm_rating` to `qualityCare`, omits `zip_code`, uses `provider_name` (not `legal_business_name`). `facility.test.ts` happy-path test (line 94) asserts 200, `body.data.ccn === "686123"`, `body.data.providerName === "KENDALL LAKES HEALTHCARE AND REHAB CENTER"`. `mapper.test.ts` asserts `certifiedBeds === 150`, `address === {street:"5280 SW 157 AVENUE",city:"MIAMI",state:"FL"}` (no zip), and `starRatings.qualityCare === 5`. 127 tests pass, verify:full green. |
| 2 | `GET /api/facility?ccn=000000` returns 404 with a distinct error payload, and `?ccn=12` returns 400 (invalid format) — each error kind is distinct | VERIFIED | `route.ts` lines 41–68: missing/short CCN → `invalid_ccn` 400 before any fetch; zero-row pipeline response → `not_found` 404 with echoed `ccn` field. `facility.test.ts` has explicit tests at lines 42 and 56 (400/invalid_ccn, fetch NOT called), and line 110 (404/not_found with `ccn` in body). All 5 error kinds map to distinct HTTP statuses (400/404/502). |
| 3 | `assembleHeader("FL")` returns the exact static branding strings and does NOT accept a facility-name argument (TypeScript-enforced) | VERIFIED | `header.ts` line 28: `export function assembleHeader(state: string): HeaderData` — one parameter only (TypeScript enforces no second argument). Returns `platformLine: "INFINITE — Managed by MEDELITE"` (em-dash verified), `reportTitle: "FACILITY ASSESSMENT SNAPSHOT"`, `stateLine: state.toUpperCase()`. `header.test.ts` asserts exact strings, uppercasing, and negative (platformLine does NOT contain "Kendall"). `tsc --noEmit` clean. |
| 4 | `assembleViewModel(facilityData, manualInputs)` produces a `ReportViewModel` where `displayName` respects the manual override, and `careCompareUrl` contains the correct CCN | VERIFIED | `view-model.ts` line 152: `displayName = manual.nameOverride?.trim() \|\| facility.providerName` (falls back on whitespace). Line 155: `careCompareUrl = \`https://www.medicare.gov/care-compare/details/nursing-home/${facility.ccn}\``. `view-model.test.ts` asserts all four displayName cases (no override, custom override, whitespace fallback, empty string fallback) and `careCompareUrl === "https://www.medicare.gov/care-compare/details/nursing-home/686123"`. `assembleHeader` called as `assembleHeader(facility.state)` — state-only (CLAUDE.md rule #2 satisfied). |
| 5 | `npm run verify:full` (typecheck + lint + format + tests + `next build`) is green | VERIFIED | Executed live: 127 tests passed (1 skipped), `next build` produced optimized build with routes `/api/facility` (dynamic) and `/api/export/pdf` (dynamic). Exit code 0. |

**Score:** 5/5 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `medelite-report/src/lib/cms/constants.ts` | `CMS_BASE_URL`, `DATASET_PROVIDER_INFO` (`4pq5-n9py`), `CCN_FILTER_FIELD` (`cms_certification_number_ccn`) | VERIFIED | All three constants present with fixture-trace comments. `4pq5-n9py` and `cms_certification_number_ccn` confirmed. SSRF boundary note included. |
| `medelite-report/src/lib/cms/types.ts` | `FacilityData` camelCase domain interface | VERIFIED | Exports `FacilityData` with no snake_case field names in the interface definition. `legal_business_name`, `federal_provider_number`, `provider_city`, `provider_state` absent from exported interface (present only in comments as "do NOT use" annotations). |
| `medelite-report/src/lib/cms/errors.ts` | `CmsApiErrorSchema`, `CmsApiError`, `CmsError`, `assertNever` | VERIFIED | `z.discriminatedUnion('kind', [...])` with exactly 5 kinds. `not_found` has `ccn: z.string()`. `validation_error` has no extra field (D-05). `CmsError extends Error`, `instanceof` works, `name === 'CmsError'`. `assertNever` throws with message. |
| `medelite-report/src/lib/cms/mapper.ts` | `toFacilityData(parsed: ParsedProvider): FacilityData` | VERIFIED | Pure function, correct field assignments: `qm_rating → qualityCare` (not longstay/shortstay variants), `provider_name → providerName` (not `legal_business_name`), `citytown → address.city`, no `zip_code` mapping. Deliberate-decision comments present. |
| `medelite-report/src/lib/cms/client.ts` | `fetchFacility(ccn): Promise<FacilityData>` | VERIFIED | Full pipeline: URL from constants (CCN as condition value only — SSRF safe), `AbortSignal.timeout(8000)`, `resp.json()` inside try/catch (CR-01 fix applied), `Array.isArray(json.results)` guard (CR-02 fix applied), `safeParseCMSRow` → `validation_error` with `console.error` server-side only (D-05/D-06). |
| `medelite-report/src/app/api/facility/route.ts` | GET handler — CCN gate + exhaustive CmsError→HTTP mapping | VERIFIED | `export const runtime = "nodejs"`. Reads from `request.nextUrl.searchParams.get('ccn')`. CCN gate: trim + uppercase + `/^[A-Za-z0-9]{6}$/` before any fetch. Exhaustive `switch(err.kind)` with `assertNever(err.kind)` at default (D-03). D-05: `validation_error` case returns ONLY `{kind, message}` — no `ccn`, no extra. |
| `medelite-report/src/lib/report/header.ts` | `assembleHeader(state): HeaderData` — state-only arg | VERIFIED | Single `state: string` parameter. Returns exact static strings with em-dash. TypeScript enforces no second argument. |
| `medelite-report/src/lib/report/format.ts` | `formatRating/formatBeds/formatPercent/formatRate/formatLocation/formatDate` | VERIFIED | All formatters open with `if (value === null) return PLACEHOLDER` (D-10 — strict null check, not falsiness). `formatLocation` emits no ZIP. `formatDate` uses `timeZone: 'UTC'` (D-13). Private `PLACEHOLDER = 'N/A'` shared by all. |
| `medelite-report/src/lib/report/view-model.ts` | `ReportViewModelSchema`, `ReportViewModel`, `ManualInputs`, `assembleViewModel` | VERIFIED | `ReportViewModelSchema` is complete with `careCompareUrl` hardened via `.refine()` to `https://www.medicare.gov` only (CR-03 fix applied). `assembleViewModel` is pure/deterministic — `generatedAt` injected, no `new Date()` internally. `hospMetrics: z.unknown().optional()` for Phase 5. |
| `medelite-report/src/app/api/export/pdf/route.ts` | POST stub — Zod-validates ReportViewModel body → 400/501 | VERIFIED | `export const runtime = "nodejs"`. `request.json()` wrapped in try/catch (WR-01 fix applied). `ReportViewModelSchema.safeParse(body)` → 400 `invalid_request` on fail (no Zod internals), 501 `not_implemented` on pass. |
| `medelite-report/next.config.ts` | `serverExternalPackages: ['@react-pdf/renderer']` | VERIFIED | Line 12: `serverExternalPackages: ["@react-pdf/renderer"]`. Correct NJS16 key name (not the v14 `serverComponentsExternalPackages`). Verified by `next build` completing. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `route.ts` (facility) | `client.ts fetchFacility` | `await fetchFacility(ccn)` inside try/catch | WIRED | Line 72: `const facility = await fetchFacility(ccn)` |
| `client.ts` | `parse.ts safeParseCMSRow` + `mapper.ts toFacilityData` | `safeParse → validation_error on fail, else toFacilityData` | WIRED | Lines 107–123: `safeParseCMSRow(results[0])`, on failure throws `validation_error`, on success `return toFacilityData(parseResult.data)` |
| `client.ts` | `constants.ts CMS_BASE_URL/DATASET_PROVIDER_INFO/CCN_FILTER_FIELD` | URL built from constants; CCN is condition value only | WIRED | Lines 43–48: `new URL(\`${CMS_BASE_URL}/${DATASET_PROVIDER_INFO}/0\`)`, `url.searchParams.set("conditions[0][property]", CCN_FILTER_FIELD)`, `url.searchParams.set("conditions[0][value]", ccn)` |
| `view-model.ts assembleViewModel` | `header.ts assembleHeader` | `assembleHeader(facility.state)` — state-only | WIRED | Line 149: `const header = assembleHeader(facility.state)` — no facility-name arg (CLAUDE.md rule #2 enforced) |
| `export/pdf/route.ts` | `view-model.ts ReportViewModelSchema` | `ReportViewModelSchema.safeParse(body)` | WIRED | Line 38: `const parseResult = ReportViewModelSchema.safeParse(body)` |
| `next.config.ts` | `@react-pdf/renderer` | `serverExternalPackages` array | WIRED | Line 12: `serverExternalPackages: ["@react-pdf/renderer"]` |

---

### Data-Flow Trace (Level 4)

These are server-side API routes (not React components rendering state). Data flows are verified via tests with mocked/real fetch rather than rendered DOM inspection.

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `route.ts GET /api/facility` | `facility: FacilityData` | `fetchFacility(ccn)` → CMS API | Yes — Zod-validated via `safeParseCMSRow`, mapped via `toFacilityData` | FLOWING |
| `export/pdf/route.ts POST` | `parseResult.data: ReportViewModel` | `ReportViewModelSchema.safeParse(body)` | Yes — validated; 501 stub for Phase 4 as designed | FLOWING (stub per design) |
| `view-model.ts assembleViewModel` | `ReportViewModel` | `FacilityData` + `ManualInputs` + injected `generatedAt` | Yes — pure function from validated CMS data | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All Phase 2 tests pass | `npx vitest run tests/lib/cms/errors.test.ts tests/lib/cms/mapper.test.ts tests/lib/cms/client.test.ts tests/api/facility.test.ts tests/lib/report/header.test.ts tests/lib/report/format.test.ts tests/lib/report/view-model.test.ts tests/api/export-pdf.test.ts` | 75 tests, all passed | PASS |
| Full verify gate green | `npm run verify:full` | 127 tests passed, 1 skipped, `next build` completed cleanly | PASS |
| `serverExternalPackages` in next.config | `grep "serverExternalPackages" next.config.ts` | Found on line 12 | PASS |
| No debt markers (TBD/FIXME/XXX) in phase 2 source files | `grep -rn "TBD\|FIXME\|XXX" src/lib/cms/{constants,types,errors,mapper,client}.ts src/app/api/facility/route.ts src/lib/report/{header,format,view-model}.ts src/app/api/export/pdf/route.ts next.config.ts` | No output — zero markers | PASS |
| `types.ts` contains no prohibited snake_case field names in exported interface | `grep -n "federal_provider_number\|provider_city\|provider_state\|legal_business_name" src/lib/cms/types.ts` | Only in comments (NOT in interface body) | PASS |
| `qm_rating` used (not longstay/shortstay variants) in production code | `grep -rn "longstay_qm_rating\|shortstay_qm_rating" src/` | Only in comments as "do NOT use" warnings | PASS |
| `validation_error` route body leaks no Zod internals | Test `"D-05 LEAK INVARIANT"` in `facility.test.ts` (line 174) | `JSON.stringify(body)` does not match `/issues\|expected\|received\|path\|code/` | PASS |

---

### Probe Execution

No phase-declared probes. Not a migration/tooling phase. Step 7c: SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| DATA-01 | 02-02 | App fetches facility data from CMS by CCN via server-side route handler | SATISFIED | `GET /api/facility` route in `src/app/api/facility/route.ts`; fetches via `fetchFacility(ccn)` server-side; CORS safe. Tests confirm. |
| DATA-03 | 02-02, 02-03 | Location composed from `provider_address + citytown + state`, no ZIP | SATISFIED | `mapper.ts` maps `citytown → address.city`, omits `zip_code`. `formatLocation` returns `street, city, state` with no ZIP. Tests confirm `address === {street:"5280 SW 157 AVENUE",city:"MIAMI",state:"FL"}` and `JSON.stringify(facility)` contains no `"zip"`. |
| DATA-04 | 02-02 | Four star ratings including Quality from `qm_rating` | SATISFIED | `mapper.ts` maps `qm_rating → starRatings.qualityCare` (not `longstay_qm_rating`/`shortstay_qm_rating`). `mapper.test.ts` asserts `qualityCare === 5` (vs `shortstay_qm_rating === 3` which discriminates the correct field). |
| DATA-05 | 02-02 | Census capacity from CMS certified beds | SATISFIED | `mapper.ts` maps `number_of_certified_beds → certifiedBeds`. `mapper.test.ts` asserts `certifiedBeds === 150`. |
| NAME-01 | 02-02 | Report defaults to CMS legal name | SATISFIED | `mapper.ts` maps `provider_name → providerName` (D-15: NOT `legal_business_name`). `assembleViewModel` defaults `displayName = facility.providerName`. Tests confirm `providerName === "KENDALL LAKES HEALTHCARE AND REHAB CENTER"` (no `, LLC`). |
| NAME-02 | 02-03 | Optional custom name overrides CMS name in report body only | SATISFIED | `assembleViewModel` sets `displayName = manual.nameOverride?.trim() \|\| facility.providerName`. Override affects only `displayName`; `vm.header.platformLine` is unchanged. `view-model.test.ts` has four displayName tests including whitespace fallback and NAME-02 isolation test. |
| RPT-01 | 02-03 | Static `INFINITE — Managed by MEDELITE` / `FACILITY ASSESSMENT SNAPSHOT` header — never overwritten by facility name | SATISFIED | `assembleHeader(state: string): HeaderData` — single string parameter (TypeScript-enforced; no facility-name arg possible). Returns exact static strings. Called as `assembleHeader(facility.state)` in `assembleViewModel`. `header.test.ts` asserts exact strings, no facility name in output. |
| RPT-02 | 02-03 | Single shared `ReportViewModel` drives web preview, PDF, and .docx | SATISFIED | `ReportViewModelSchema`/`ReportViewModel`/`assembleViewModel` in `view-model.ts`. `POST /api/export/pdf` validates against `ReportViewModelSchema`. `assembleViewModel` is pure/deterministic (injected `generatedAt`). Phase 4 PDF and Phase 6 .docx will render from the same schema. |

**All 8 required requirement IDs covered and SATISFIED.**

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/app/api/facility/route.ts` | 58 | `[A-Za-z0-9]` regex after `.toUpperCase()` — lowercase range unreachable (IN-01) | Info | Harmless dead code; regex still accepts correct inputs. Deferred from review as cosmetic. Not a blocker. |
| `src/app/api/facility/route.ts` | 55 | `.slice(0, 20)` redundant with `{6}` length gate (IN-02) | Info | No functional impact; gate always passes/fails on the 6-char constraint. Deferred from review. Not a blocker. |
| `src/lib/report/format.ts` | 71 | `formatDate` returns `"Invalid Date"` string for non-date input (IN-03) | Info | `processingDate` is `z.string()` without date-format constraint. A malformed CMS value would render silently. Deferred from review as low-impact for Phase 2. Not a blocker. |

No `TBD`, `FIXME`, or `XXX` markers found in any Phase 2 source file. The three info-level items above were identified in the code review (02-REVIEW.md) and explicitly deferred as cosmetic/low-impact.

---

### Human Verification Required

None. All Phase 2 success criteria are verifiable programmatically (server-side API contracts, type signatures, test outcomes, build gate). No UI rendering, user flows, or real-time behavior is introduced in this phase.

---

### CLAUDE.md Standing Invariants Check

| Invariant | Rule | Status | Evidence |
|-----------|------|--------|---------|
| `assembleHeader()` takes no facility-name argument | Rule #2 | VERIFIED | Signature is `assembleHeader(state: string): HeaderData` — one parameter. TypeScript would reject a second argument. |
| CMS field names trace to fixture/dictionary | Rule #3 | VERIFIED | `CCN_FILTER_FIELD = "cms_certification_number_ccn"` (fixture key), `DATASET_PROVIDER_INFO = "4pq5-n9py"` (confirmed via capture script and fixture). `mapper.ts` maps only fields present in `schema.ts` which is anchored to `provider-686123.json`. |
| Every CMS response Zod-validated | Rule #4 | VERIFIED | `client.ts` calls `safeParseCMSRow(results[0])` before calling `toFacilityData`. Unvalidated CMS data never reaches the UI or export. |
| D-05 leak invariant holds | Security | VERIFIED | `validation_error` case in `route.ts` returns ONLY `{kind, message}` — no `ccn`, no `extra`, no Zod issue paths. Enforced by explicit test `"D-05 LEAK INVARIANT"` in `facility.test.ts` which asserts `JSON.stringify(body)` does not match `/issues|expected|received|path|code/`. |
| PDF uses `@react-pdf/renderer` only | Rule per CLAUDE.md | VERIFIED | `POST /api/export/pdf` stub returns 501 — no PDF rendered in Phase 2. `next.config.ts` declares `serverExternalPackages: ["@react-pdf/renderer"]` for Phase 4. |

---

### Gaps Summary

No gaps. All 5 phase success criteria are verified. All 8 requirement IDs (DATA-01, DATA-03, DATA-04, DATA-05, NAME-01, NAME-02, RPT-01, RPT-02) are satisfied by delivered, tested code. The CLAUDE.md standing invariants hold. The three info-level items from the code review are cosmetic and were explicitly deferred — none blocks the phase goal.

`npm run verify:full` ran live and exited 0: 127 tests passed, `next build` completed with routes `/api/facility` and `/api/export/pdf` appearing in the output.

---

_Verified: 2026-06-17T15:55:00Z_
_Verifier: Claude (gsd-verifier)_
