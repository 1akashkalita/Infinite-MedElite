# Phase 2: API Routes, View Model & Config — Research

**Researched:** 2026-06-17
**Domain:** Next.js 16.2.x Route Handlers / Zod v4 discriminated unions / CMS fetch client / ReportViewModel
**Confidence:** HIGH — all critical facts verified against installed source files, fixture, and live Node.js runtime

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Error contract (API seam)**
- D-01: 5-kind error taxonomy: `invalid_ccn`→400, `not_found`→404, `network_error`→502, `cms_api_error`→502, `validation_error`→502
- D-02: Structured body `{ error: { kind, message, ...extra } }` with server-supplied default message
- D-03: Error body is a shared Zod discriminated union, exported for Phase 3; adding a 6th kind must produce a compile error in Phase 3's switch (exhaustiveness via `assertNever`)
- D-04: `network_error`/`cms_api_error` may use retry copy; `validation_error` must NOT (honest non-retry copy)

**Diagnostics & info-leak discipline**
- D-05: `validation_error` leaks nothing to client — full `z.prettifyError` output is server-side `console.error` only; issue count acceptable, full paths not
- D-06: Server log on `validation_error` includes the triggering CCN alongside prettified issues
- D-07: Only normalized, length-capped CCN echoed; cap before reflection

**View model, formatters & dates**
- D-08: `ReportViewModel` carries raw `number | null` never pre-stringified; formatter family: `formatRating`, `formatBeds`, `formatPercent`, `formatRate`; all share one null→placeholder rule and one `"N/A"` constant
- D-09: Suppressed/null placeholder = `"N/A"` (for core facility fields)
- D-10: Formatter checks `=== null`, NEVER falsiness (a rate of 0 is real data)
- D-11: Chart paths read raw `number | null` directly — never route through `formatRating`
- D-12: Two dates — `generatedAt` injected via parameter (pure/deterministic); `processingDate` from `processing_date` CMS field
- D-13: Date formatting in a fixed/explicit TZ (or inject pre-formatted string) to prevent server/client midnight disagreement

**FacilityData shape & mapper**
- D-14: Curated camelCase `FacilityData`, NOT raw `ParsedProvider`; CMS field names live only in `schema.ts` + `mapper.ts`
- D-15: `providerName ← provider_name` (NOT `legal_business_name`) — fixture-verified deliberate choice
- D-16: Exact mapper sources: `overall_rating`, `health_inspection_rating`, `staffing_rating`, `qm_rating` (NOT `longstay_qm_rating`/`shortstay_qm_rating`), `number_of_certified_beds`, `processing_date`, CCN and `state` as strings
- D-17: `FacilityData.address = { street, city, state }`; `formatLocation()` composes with no ZIP; parts remain available separately

**CMS fetch client**
- D-18: `fetchFacility(ccn): Promise<FacilityData>` — full pipeline in `client.ts`; throws typed `CmsError`; route handler is thin
- D-19: 8s timeout via `AbortSignal.timeout(8000)` → `network_error`

**PDF export stub**
- D-20: POST body = full `ReportViewModel`
- D-21: Stub validates body (Zod) → 400 on bad shape, 501 on valid; `ReportViewModelSchema` defined now

### Claude's Discretion
- D-22: CCN gate = `/^[A-Za-z0-9]{6}$/`, uppercase-normalize + trim before gate
- D-23: No auto-retry
- D-24: Base URL + `4pq5-n9py` in `src/lib/cms/constants.ts`; filter field `cms_certification_number_ccn`
- D-25: Add `serverExternalPackages: ['@react-pdf/renderer']` to `next.config.ts`; verify with `npm run verify:full`; Node.js runtime for routes touching react-pdf
- Module layout under `src/lib/`: `cms/client.ts`, `cms/mapper.ts`, `cms/types.ts`, `cms/errors.ts`, `cms/constants.ts`, `report/header.ts`, `report/view-model.ts`, `report/format.ts`

### Deferred Ideas (OUT OF SCOPE)
- Real PDF rendering (`renderToBuffer`, `<ReportPDF/>`, Medicare `<Link>`) → Phase 4
- Web UI, CCN search, live preview, error UI, Vercel deploy → Phase 3
- Claims `hospMetrics` schemas + 12 data points → Phase 5
- `.docx` export → Phase 6
- Star-rating cards + charts + 300ms debounce → Phase 7
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Server-side route handler fetches CMS by CCN (no direct browser→CMS) | NJS16 Route Handler API verified; `export async function GET(request: NextRequest)` in `app/api/facility/route.ts`; reads CCN from `request.nextUrl.searchParams` |
| DATA-03 | Location composed from `provider_address` + `citytown` + `state`, no ZIP | All three fields verified in fixture; `formatLocation()` in `report/format.ts` per D-17 |
| DATA-04 | Four star ratings: Overall, Health Inspection, Staffing, Quality (`qm_rating`) | All four fields verified in fixture with correct values; `qm_rating="5"` ≠ `longstay_qm_rating="5"` ≠ `shortstay_qm_rating="3"` |
| DATA-05 | Census Capacity from `number_of_certified_beds` | Field verified in fixture: `"150"` (string) → coerced to `150` by `nullableNum` in Phase 1 schema |
| NAME-01 | Report defaults to CMS name (operating name) | `provider_name="KENDALL LAKES HEALTHCARE AND REHAB CENTER"` from fixture; D-15 confirmed |
| NAME-02 | Manual name override appears in report body only | `displayName = manual.nameOverride?.trim() \|\| facility.providerName` in `assembleViewModel`; header unaffected |
| RPT-01 | Static header never overwritten by facility name | `assembleHeader(state: string)` — state-only arg, TypeScript enforces no facility-name param |
| RPT-02 | Single shared `ReportViewModel` drives all three render targets | `assembleViewModel(facility, manual, generatedAt)` produces the canonical model |
</phase_requirements>

---

## Summary

Phase 2 builds 8 TypeScript modules (no UI) plus two route handlers, all wired into one pipeline: CCN → `fetchFacility()` → `FacilityData` → `assembleViewModel()` → `ReportViewModel`. Everything is already fully specified in CONTEXT.md (D-01–D-25). The research job is to surface implementation-level facts: exact NJS16 API signatures, verified fixture field names, Zod v4 discriminated-union idioms, and test patterns.

All 25 CONTEXT decisions are feasible against the installed NJS16.2.9 + Zod 4.4.3 + Node 26.2.0 stack. The one ARCHITECTURE.md landmine — wrong field names — is fully mapped and corrected in the Field Name Verification section below. The `serverExternalPackages` question from PITFALLS.md pitfall #4 is resolved: `@react-pdf/renderer` IS on NJS16's auto-opt-out list, but D-25 mandates adding it explicitly anyway (defensive against Turbopack bug #88844). Add it.

**Primary recommendation:** Work file-by-file in dependency order: `constants.ts` → `types.ts` → `errors.ts` → `mapper.ts` + `format.ts` → `client.ts` → `header.ts` → `view-model.ts` → `app/api/facility/route.ts` → `app/api/export/pdf/route.ts`. Test each module before writing the next.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CMS fetch + Zod validation | API / Backend (Route Handler) | — | CORS blocks browser→CMS; all fetch in `client.ts` per D-18 |
| CCN format gate | API / Backend | — | Validated server-side before fetch; client validation (Phase 3) is UX-only |
| `FacilityData` assembly | API / Backend (`mapper.ts`) | — | CMS field names must not leak to client; single mapping point |
| Error taxonomy (5 kinds) | API / Backend (`errors.ts`) | Frontend consumer (Phase 3) | Server assigns kind; Phase 3 imports the schema for type-safe switch |
| `assembleHeader(state)` | Shared pure module | — | No React, no I/O; consumed by preview/PDF/docx equally |
| `ReportViewModel` assembly | Shared pure module | — | Deterministic, testable; `assembleViewModel(facility, manual, generatedAt)` |
| Null→"N/A" formatting | Shared pure module (`format.ts`) | — | Single formatter family; raw numbers stay in model for Phase 7 charts |
| PDF stub (501) | API / Backend (Route Handler) | — | POST validates body Zod; Phase 4 replaces 501 with `renderToBuffer` |
| `next.config.ts` | Build / Config | — | `serverExternalPackages` opt-out for Turbopack safety |

---

## Project Constraints (from CLAUDE.md)

Actionable directives that research and planning must honor:

1. **Every task must pass `npm run verify` before complete** — typecheck → lint → format:check → test. Phase 2 closes on `npm run verify:full` (adds `next build`).
2. **`assembleHeader()` takes no facility-name argument** — CLAUDE.md rule #2 / PITFALLS.md pitfall #13.
3. **Never trust a CMS field name from memory** — CLAUDE.md rule #3. Use fixture `provider-686123.json` as the single source. (ARCHITECTURE.md mapper sketch has 5 wrong field names — see Field Name Verification below.)
4. **Zod validates every CMS response before render/export** — CLAUDE.md rule #4.
5. **Tests first or alongside, never after** — CLAUDE.md rule #5.
6. **Handle and test every error path** — CLAUDE.md rule #6.
7. **PDF uses `@react-pdf/renderer` only** — the stub in Phase 2 need not import it yet, but `ReportViewModelSchema` must be defined for Phase 4.

---

## 1. Next.js 16.2.x Route Handler API

**Source:** `medelite-report/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` [VERIFIED]

### Function signature

```typescript
// app/api/facility/route.ts
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  // reads CCN from query string — NOT from ctx.params (this is NOT a dynamic route)
  const ccn = request.nextUrl.searchParams.get('ccn')
  // ...
  return Response.json(body, { status: 200 })
}
```

```typescript
// app/api/export/pdf/route.ts
export async function POST(request: Request) {
  const body = await request.json()
  // ...
}
```

### The `params` promise question (CONTEXT canonical ref says "await ctx.params")

`params` is a Promise only for **dynamic route segment** files (e.g., `app/api/facility/[ccn]/route.ts`).

`GET /api/facility?ccn=...` uses a **query string, not a path segment**. The route file is `app/api/facility/route.ts` (non-dynamic). It has NO `ctx.params` at all. CCN comes from `request.nextUrl.searchParams.get('ccn')`. [VERIFIED: route.md "URL Query Parameters" section]

If the design were changed to `/api/facility/[ccn]`, then:
```typescript
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ccn: string }> }
) {
  const { ccn } = await params  // await required in NJS16
}
```

**Planner action:** Use query string (`?ccn=`) per CONTEXT D-18. No `ctx.params` in scope for this route.

### Reading a query string param

```typescript
// Standard pattern (from route.md "URL Query Parameters"):
const ccn = request.nextUrl.searchParams.get('ccn') // returns string | null
```

### Returning JSON with a status code

```typescript
return Response.json(body, { status: 400 })
// OR (equivalent, needs NextResponse import):
import { NextResponse } from 'next/server'
return NextResponse.json(body, { status: 400 })
```

**Recommendation:** Use `Response.json()` — it's the web-standard, requires no import. [VERIFIED: route.md examples]

### Setting the Node.js runtime (D-25)

```typescript
// At top of route file (segment config):
export const runtime = 'nodejs'
```

`'nodejs'` is the **default** runtime [VERIFIED: runtime.md "nodejs (default)"]. Explicit declaration is harmless, documents intent, and makes it future-proof if someone adds Edge runtime. Required for any route that will later import `@react-pdf/renderer`.

### Default caching behavior in NJS16

Changed at v15.0.0 RC: **GET route handlers are now dynamic by default** (no static cache). [VERIFIED: route.md Version History "v15.0.0-RC: default caching for GET handlers changed from static to dynamic"]

For a live CMS proxy this is the correct behavior — every request hits the origin. No `export const dynamic = 'force-dynamic'` needed in NJS16; it is the default. Per-fetch revalidation (`fetch(url, { next: { revalidate: 3600 } })`) still works if desired, but is independent of route-level caching.

---

## 2. `serverExternalPackages` in `next.config.ts`

**Source:** `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md` [VERIFIED]

`@react-pdf/renderer` IS on NJS16's built-in auto-opt-out list (confirmed in the installed doc — it appears explicitly in the list).

D-25 says to add it explicitly anyway, as a defensive measure against Turbopack bug #88844 (PITFALLS.md pitfall #10). This is correct. The explicit declaration is idempotent if already auto-opted-out.

**Exact config shape** (TypeScript, ESM):

```typescript
// medelite-report/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@react-pdf/renderer'],
};

export default nextConfig;
```

`serverExternalPackages` is a **top-level key** of `NextConfig` (renamed from `serverComponentsExternalPackages` at v15.0.0 — the NJS16 name is confirmed). [VERIFIED: serverExternalPackages.md version history]

**Current state:** `medelite-report/next.config.ts` currently has an empty config object. Adding `serverExternalPackages` is a one-line change.

**Verify immediately after:** `npm run verify:full` — this runs `next build` which will surface any Turbopack standalone omission.

---

## 3. Field Name Verification (Rule #3 — Fixture is Authoritative)

**Source:** `medelite-report/tests/fixtures/provider-686123.json` [VERIFIED — all field names confirmed by `node -e` against live fixture]

### Verified mapper field names (D-15 / D-16)

| CMS field name | Fixture value (CCN 686123) | Maps to `FacilityData` | Notes |
|---|---|---|---|
| `cms_certification_number_ccn` | `"686123"` | `ccn: string` | Confirmed correct. NOT `federal_provider_number`. |
| `provider_name` | `"KENDALL LAKES HEALTHCARE AND REHAB CENTER"` | `providerName: string` | Operating name. Use THIS, not `legal_business_name`. |
| `legal_business_name` | `"KENDALL LAKES HEALTHCARE AND REHAB CENTER, LLC"` | — (NOT mapped) | Has `, LLC` suffix. D-15: deliberately omitted. |
| `overall_rating` | `"5"` | `starRatings.overall: number \| null` | String in CMS; `nullableNum` coerces to `5`. |
| `health_inspection_rating` | `"5"` | `starRatings.healthInspection: number \| null` | — |
| `staffing_rating` | `"2"` | `starRatings.staffing: number \| null` | Note: 2, not 5. |
| `qm_rating` | `"5"` | `starRatings.qualityCare: number \| null` | Correct Quality field. |
| `longstay_qm_rating` | `"5"` | — (NOT mapped) | D-16: explicitly excluded. |
| `shortstay_qm_rating` | `"3"` | — (NOT mapped) | D-16: explicitly excluded. Differs from `qm_rating`. |
| `number_of_certified_beds` | `"150"` | `certifiedBeds: number \| null` | String coerced by `nullableNum`. |
| `provider_address` | `"5280 SW 157 AVENUE"` | `address.street: string` | — |
| `citytown` | `"MIAMI"` | `address.city: string` | NOT `provider_city` (ARCHITECTURE.md was wrong). |
| `state` | `"FL"` | `address.state: string` + used in `assembleHeader(state)` | NOT `provider_state` (ARCHITECTURE.md was wrong). |
| `zip_code` | `"33185"` | — (NOT in `FacilityData` — no ZIP per DATA-03) | `location` field `"5280 SW 157 AVENUE,MIAMI,FL,33185"` also available but includes ZIP; do not use. |
| `processing_date` | `"2026-05-01"` | `processingDate: string` | D-12: the CMS-data freshness signal. |

### ARCHITECTURE.md field names that are WRONG (per CONTEXT canonical ref caution)

| ARCHITECTURE.md sketch | Correct field (fixture) |
|---|---|
| `federal_provider_number` | `cms_certification_number_ccn` |
| `provider_state` | `state` |
| `provider_city` | `citytown` |
| `provider_zip_code` | `zip_code` |
| `quality_measure_rating` | `qm_rating` |
| `legalName` (vm field) | `providerName` (from `provider_name`) |

**Planner must not copy field names from ARCHITECTURE.md mapper sketch.** Use the table above.

---

## 4. Phase-1 Contract (What Mapper Consumes)

**Source:** `src/lib/cms/schema.ts` + `src/lib/cms/parse.ts` [VERIFIED — files read directly]

### `ParsedProvider` type (output of `CMSRowSchema.safeParse`)

```typescript
// Relevant fields (after nullableNum coercion):
{
  cms_certification_number_ccn: string       // kept as string
  provider_name: string
  legal_business_name: string
  provider_address: string
  citytown: string
  state: string
  zip_code: string                           // kept as string
  processing_date: string
  number_of_certified_beds: number | null    // coerced
  overall_rating: number | null              // coerced
  health_inspection_rating: number | null    // coerced
  qm_rating: number | null                  // coerced
  staffing_rating: number | null             // coerced
  // ...passthrough: all other CMS fields preserved
}
```

### `safeParseCMSRow(raw: unknown)` return type

Returns `CMSRowSchema.safeParse(raw)` — a `SafeParseReturnType<ParsedProvider>`.

- On success: `{ success: true, data: ParsedProvider }`
- On failure: `{ success: false, error: ZodError }` — use `result.error.issues` (v4) and `z.prettifyError(result.error)` for human text.

**Mapper consumption pattern:**

```typescript
// In client.ts (D-18):
const parseResult = safeParseCMSRow(rawRow)
if (!parseResult.success) {
  console.error(`[validation_error] CCN=${ccn}`, z.prettifyError(parseResult.error))
  throw new CmsError('validation_error', 'We couldn\'t read this facility\'s data right now.')
}
const parsed: ParsedProvider = parseResult.data
// pass to toFacilityData(parsed)
```

---

## 5. Zod v4 Discriminated Union — Error Envelope (D-03)

**Source:** Zod 4.4.3 installed at `node_modules/zod` — tested live [VERIFIED]

### API confirmed working in Zod 4.4.3

```typescript
import { z } from 'zod'

// Facility route error kinds (D-01)
export const FacilityApiErrorSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('invalid_ccn'),     message: z.string() }),
  z.object({ kind: z.literal('not_found'),        message: z.string(), ccn: z.string() }),
  z.object({ kind: z.literal('network_error'),    message: z.string() }),
  z.object({ kind: z.literal('cms_api_error'),    message: z.string() }),
  z.object({ kind: z.literal('validation_error'), message: z.string() }),
])

export type FacilityApiError = z.infer<typeof FacilityApiErrorSchema>
// TypeScript union: { kind: 'invalid_ccn'; message: string } | { kind: 'not_found'; message: string; ccn: string } | ...

export const FacilityErrorEnvelopeSchema = z.object({ error: FacilityApiErrorSchema })
```

All 5 kinds parse correctly; an unknown kind is rejected. Verified live against installed Zod 4.4.3.

### Zod v4 idioms (CONFIRMED in parse.ts and live test)

- Error access: `result.error.issues` — the ZodIssue array (v3's `.errors` property is `undefined` in v4)
- Human text: `z.prettifyError(result.error)` — verified available and working
- `z.infer<typeof Schema>` — works identically to v3

### Exhaustiveness check pattern for D-03 (compile-time safety)

```typescript
// In cms/errors.ts:
export function assertNever(x: never): never {
  throw new Error('Unhandled CmsError kind: ' + JSON.stringify(x))
}

// Usage in route handler (Phase 3 imports this same union):
function toCmsError(e: CmsError) {
  switch (e.kind) {
    case 'invalid_ccn':     return { status: 400, body: { error: e } }
    case 'not_found':       return { status: 404, body: { error: e } }
    case 'network_error':   return { status: 502, body: { error: e } }
    case 'cms_api_error':   return { status: 502, body: { error: e } }
    case 'validation_error':return { status: 502, body: { error: e } }
    default:                return assertNever(e)  // compile error if new kind added without case
  }
}
```

When Phase 3 imports `CmsError` and `assertNever` from `src/lib/cms/errors.ts` and adds a 6th kind, TypeScript will flag any switch that doesn't handle it — fulfilling D-03.

### Zod v4 vs v3 discriminated union

No API difference in `z.discriminatedUnion`. The v4 change relevant to this project: error access uses `.issues` not `.errors` (confirmed). No migration needed beyond that.

---

## 6. CMS Fetch Client — D-18/D-19

**Source:** STACK.md (VERIFIED against fixture + runtime test), CMS API behavior confirmed in Phase 1 fixture

### Exact URL shape

```typescript
// From constants.ts (D-24):
export const CMS_BASE_URL = 'https://data.cms.gov/provider-data/api/1/datastore/query'
export const DATASET_PROVIDER_INFO = '4pq5-n9py'

// In client.ts:
const url = new URL(`${CMS_BASE_URL}/${DATASET_PROVIDER_INFO}/0`)
url.searchParams.set('conditions[0][property]', 'cms_certification_number_ccn')
url.searchParams.set('conditions[0][value]', ccn)
url.searchParams.set('conditions[0][operator]', '=')  // single '=', NOT '=='
url.searchParams.set('limit', '1')
// Result: .../4pq5-n9py/0?conditions%5B0%5D%5Bproperty%5D=cms_certification_number_ccn&...%5Boperator%5D=%3D&limit=1
```

`URL.searchParams.set` auto-encodes `=` to `%3D`. This is correct — CMS accepts it. [VERIFIED: STACK.md + confirmed by URL encoding test]

**CRITICAL:** Use `=` (single equals) as the operator string. The string `==` is invalid and returns HTTP 400 from CMS. [VERIFIED: STACK.md]

### Timeout — D-19

```typescript
const resp = await fetch(url.toString(), {
  signal: AbortSignal.timeout(8000),
})
```

`AbortSignal.timeout` is available in Node 26.2.0 (the runtime on this machine) and in Vercel's Node.js serverless function environment (Node 20+). [VERIFIED: `typeof AbortSignal.timeout === 'function'` in Node 26.2.0]

An abort/timeout throws a `DOMException` with `name === 'AbortError'`. Catch this and map to `network_error`.

### Zero-row response → `not_found`

CMS API shape: `{ count: number, results: Array<Record> }`. A CCN with no match returns `{ count: 0, results: [] }`. Detection: `results.length === 0` (or `count === 0`).

```typescript
const json = await resp.json() as { count: number; results: unknown[] }
if (json.results.length === 0) throw new CmsError('not_found', `No facility found for CCN ${ccn}.`)
const raw = json.results[0]
```

### Full pipeline in `client.ts`

```typescript
export async function fetchFacility(ccn: string): Promise<FacilityData> {
  // CCN validation happens in route handler BEFORE this call (D-22)
  const url = buildCmsUrl(ccn)
  
  let resp: Response
  try {
    resp = await fetch(url, { signal: AbortSignal.timeout(8000) })
  } catch (e) {
    // AbortError from timeout, or network failure
    throw new CmsError('network_error', 'CMS data is unavailable — please try again.')
  }
  
  if (!resp.ok) {
    throw new CmsError('cms_api_error', 'CMS returned an error — please try again.')
  }
  
  const json = await resp.json() as { count: number; results: unknown[] }
  if (json.results.length === 0) {
    throw new CmsError('not_found', `No facility found for CCN ${ccn}.`, { ccn })
  }
  
  const parseResult = safeParseCMSRow(json.results[0])
  if (!parseResult.success) {
    console.error(`[validation_error] CCN=${ccn}`, z.prettifyError(parseResult.error))  // D-06
    throw new CmsError('validation_error', "We couldn't read this facility's data right now.")  // D-04/D-05
  }
  
  return toFacilityData(parseResult.data)
}
```

---

## 7. ReportViewModel — D-08 / D-12 / D-13

**Source:** CONTEXT.md D-08 through D-17; ARCHITECTURE.md structure (not field names)

### Corrected `assembleViewModel` signature

```typescript
// report/view-model.ts
export function assembleViewModel(
  facility: FacilityData,
  manual: ManualInputs,
  generatedAt: Date | string,  // D-12: injected by caller; tests pass a fixed value
): ReportViewModel
```

**Not** `new Date()` inside the function — that makes it non-deterministic and untestable. The route handler passes `new Date()` or an ISO string; tests pass a fixed date.

### `displayName` resolution

```typescript
displayName: manual.nameOverride?.trim() || facility.providerName
```

Note: `facility.providerName` comes from `provider_name` (D-15) — the operating name without `LLC`.

### `careCompareUrl` derivation

```typescript
careCompareUrl: `https://www.medicare.gov/care-compare/details/nursing-home/${facility.ccn}`
```

`facility.ccn` is the string `"686123"` (leading zeros preserved as string per D-16).

### `hospMetrics` stays optional

```typescript
hospMetrics?: HospMetricsData  // Phase 5 fills this; absent in Phase 2
```

### `processingDate` in the model

```typescript
processingDate: facility.processingDate  // "2026-05-01" for CCN 686123
```

This is the "CMS data as of…" freshness field, distinct from `generatedAt` ("Generated on…"). Both must appear in the model so Phase 3 can render both.

### Timezone-safe date formatting (D-13)

**Problem:** `new Date('2026-05-01').toLocaleDateString()` gives different results on the server (UTC) vs. the client (user's TZ) near midnight.

**Recommended approach:** `assembleViewModel` stores the raw `generatedAt` value (Date or ISO string). The shared `formatDate(value: Date | string)` formatter in `format.ts` must format date-only in an explicit timezone:

```typescript
// Option A — inject already-formatted string from the route handler:
generatedAt: new Date().toLocaleDateString('en-US', {
  year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York'
})

// Option B — store raw, format in formatter with explicit TZ:
export function formatDate(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value
  return d.toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC'
  })
}
```

Option A (inject pre-formatted string) is simpler and avoids TZ complexity everywhere the model is consumed. For `processingDate` (already a date-only string `"2026-05-01"`), parse as UTC to avoid off-by-one: `new Date('2026-05-01T00:00:00Z')`.

---

## 8. Unit Testing Route Handlers in Vitest (No Running Server)

**Source:** Node 26.2.0 runtime verification + Vitest patterns [VERIFIED]

### Pattern: import exported function, pass constructed `Request`

```typescript
// tests/api/facility.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { GET } from '@/app/api/facility/route'  // import the exported function directly

afterEach(() => vi.unstubAllGlobals())

it('returns 400 for invalid CCN format', async () => {
  const req = new Request('http://localhost/api/facility?ccn=12')
  const resp = await GET(req as any)
  expect(resp.status).toBe(400)
  const body = await resp.json()
  expect(body.error.kind).toBe('invalid_ccn')
})
```

`Request` and `Response` are available in Node 26 natively (no special setup). `NextRequest` can also be imported directly for tests that need `nextUrl`:

```typescript
import { NextRequest } from 'next/server'
const req = new NextRequest('http://localhost/api/facility?ccn=686123')
```

### Stubbing global `fetch` for `client.ts` unit tests (D-18)

```typescript
import { vi, afterEach } from 'vitest'

afterEach(() => vi.unstubAllGlobals())

it('throws network_error when fetch is aborted', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(
    new DOMException('The operation was aborted.', 'AbortError')
  ))
  await expect(fetchFacility('686123')).rejects.toMatchObject({ kind: 'network_error' })
})

it('throws not_found for zero-row response', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 })
  ))
  await expect(fetchFacility('000000')).rejects.toMatchObject({ kind: 'not_found' })
})

it('throws validation_error for malformed CMS row', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ count: 1, results: [{ broken: true }] }), { status: 200 })
  ))
  await expect(fetchFacility('686123')).rejects.toMatchObject({ kind: 'validation_error' })
})
```

`global.fetch` is available in Node 26 natively; `vi.stubGlobal` replaces it for the test.

---

## 9. Formatter Family Design (D-08 through D-11)

```typescript
// report/format.ts

const PLACEHOLDER = 'N/A'  // D-09: single constant, shared

// D-10: check === null, NEVER falsiness
export function formatRating(value: number | null): string {
  if (value === null) return PLACEHOLDER
  return String(value)  // star ratings are integers 1-5
}

export function formatBeds(value: number | null): string {
  if (value === null) return PLACEHOLDER
  return value.toLocaleString()
}

export function formatPercent(value: number | null): string {
  if (value === null) return PLACEHOLDER
  return `${value.toFixed(1)}%`
}

export function formatRate(value: number | null): string {
  if (value === null) return PLACEHOLDER
  return value.toFixed(2)
}

// D-17: location formatter
export function formatLocation(address: { street: string; city: string; state: string }): string {
  return `${address.street}, ${address.city}, ${address.state}`  // no ZIP
}
```

**D-11 constraint for planner:** Do NOT route `number | null` chart data through `formatRating`. Charts (Phase 7) read raw values from `vm.facility.starRatings.overall` etc. The formatter is render-layer only.

---

## 10. `assembleHeader` Signature (RPT-01)

From ARCHITECTURE.md (structure correct here, confirmed against CLAUDE.md rule #2):

```typescript
// report/header.ts
export interface HeaderData {
  platformLine: string   // "INFINITE — Managed by MEDELITE"
  reportTitle: string    // "FACILITY ASSESSMENT SNAPSHOT"
  stateLine: string      // "FL" (uppercased)
}

export function assembleHeader(state: string): HeaderData {
  return {
    platformLine: 'INFINITE — Managed by MEDELITE',
    reportTitle: 'FACILITY ASSESSMENT SNAPSHOT',
    stateLine: state.toUpperCase(),
  }
}
```

**TypeScript enforcement:** The function has one parameter (`state: string`). Passing a facility name is a compile error.

**Test (PITFALLS.md pitfall #13):**
```typescript
const h = assembleHeader('FL')
expect(h.platformLine).not.toContain('Kendall')  // facility name must not appear
expect(h.platformLine).toBe('INFINITE — Managed by MEDELITE')
```

---

## 11. CCN Format Gate (D-22)

```typescript
// Exact regex: /^[A-Za-z0-9]{6}$/
// Pre-process: trim whitespace, uppercase-normalize
export function normalizeCcn(raw: string): string {
  return raw.trim().toUpperCase()
}
export function isValidCcn(ccn: string): boolean {
  return /^[A-Za-z0-9]{6}$/.test(ccn)
}
```

This is checked in the route handler **before** calling `fetchFacility`. On failure: return 400 with `kind: 'invalid_ccn'`.

Note: `ccn` is then passed as-is (after normalization) to `fetchFacility`; the CMS API query uses the normalized form. Test CCN `686123` passes both decimal and alphanumeric variants.

---

## 12. PDF Export Stub (D-20 / D-21)

```typescript
// app/api/export/pdf/route.ts
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body: unknown = await request.json()
  const parseResult = ReportViewModelSchema.safeParse(body)
  
  if (!parseResult.success) {
    return Response.json(
      { error: { kind: 'invalid_request', message: 'Invalid report data.' } },
      { status: 400 }
    )
  }
  
  // Phase 4 replaces this with renderToBuffer
  return Response.json(
    { error: { kind: 'not_implemented', message: 'PDF export coming soon.' } },
    { status: 501 }
  )
}
```

`ReportViewModelSchema` is a Zod schema. The export-route `kind` literals (`invalid_request`, `not_implemented`) share the **envelope shape** `{ error: { kind, message } }` with the facility route's errors (D-21). They are distinct from the facility route's 5-kind union — each route has its own `kind` literal set.

---

## Common Pitfalls (Phase 2 Specific)

### Pitfall 1: Falsiness check in formatter turns `0` into `"N/A"`
**What goes wrong:** `if (!value) return 'N/A'` — a real star rating of `0` (theoretically possible; a facility with no data may have 0 for some fields) gets displayed as `"N/A"`.
**How to avoid:** D-10 mandates `if (value === null) return PLACEHOLDER`. This is a rule, not a suggestion. [VERIFIED: schema.ts confirms `"0"` → `0` via `nullableNum`, NOT `null`]

### Pitfall 2: Extracting `ccn` from wrong location in route handler
**What goes wrong:** Using `await ctx.params` or `params.ccn` in a non-dynamic route file (no `[ccn]` segment). The route is `app/api/facility/route.ts` with `?ccn=` query param.
**How to avoid:** `request.nextUrl.searchParams.get('ccn')`. [VERIFIED: route.md]

### Pitfall 3: Using `==` as CMS filter operator
**What goes wrong:** `conditions[0][operator]==` returns HTTP 400 from CMS. The correct operator string is the single character `=`.
**How to avoid:** Hard-code `'='` as the operator string. `URL.searchParams.set` encodes it to `%3D` — correct. [VERIFIED: STACK.md]

### Pitfall 4: Leaking Zod internals in `validation_error` response body (D-05)
**What goes wrong:** Returning `{ error: { kind: 'validation_error', issues: result.error.issues } }` exposes CMS field paths, expected types, and schema internals to the client.
**How to avoid:** `validation_error` body contains ONLY `{ error: { kind: 'validation_error', message: '<generic>' } }`. The `z.prettifyError` output goes to `console.error` server-side only.
**Test (from CONTEXT specifics):** Assert the response body contains zero Zod internals — no field paths, no expected-type strings:
```typescript
const body = await resp.json()
const bodyStr = JSON.stringify(body)
expect(bodyStr).not.toMatch(/issues|expected|received|path|code/)
```

### Pitfall 5: `mappper.ts` copies wrong field names from ARCHITECTURE.md
**What goes wrong:** Using `federal_provider_number`, `provider_state`, `provider_city`, `quality_measure_rating` etc. from the ARCHITECTURE.md mapper sketch — all wrong.
**How to avoid:** Use the fixture-verified table in §3 above. Every field name in `mapper.ts` must trace to `provider-686123.json`.

### Pitfall 6: `assembleViewModel` calls `new Date()` internally
**What goes wrong:** The function is non-deterministic — tests can't pin the `generatedAt` value. RPT-02 cross-target consistency also requires a single timestamp passed from the caller.
**How to avoid:** D-12 mandates `generatedAt` as a parameter. Tests pass `new Date('2026-06-17T12:00:00Z')`.

### Pitfall 7: `serverExternalPackages` key wrong in `next.config.ts`
**What goes wrong:** Using the NJS14 name `serverComponentsExternalPackages` — silently ignored in NJS16 (it was renamed at v15.0.0).
**How to avoid:** Key is `serverExternalPackages` (confirmed in serverExternalPackages.md). [VERIFIED]

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (node environment) |
| Config file | `medelite-report/vitest.config.ts` |
| Quick run command | `npx vitest run tests/api/` (once created) |
| Full suite command | `npm run verify` (from `medelite-report/`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | GET /api/facility routes CMS via server, never browser | unit | `npx vitest run tests/api/facility.test.ts` | ❌ Wave 0 |
| DATA-03 | Location composed from 3 fields, no ZIP | unit | `npx vitest run tests/lib/report/format.test.ts` | ❌ Wave 0 |
| DATA-04 | `qm_rating` mapped, not `longstay_qm_rating` | unit | `npx vitest run tests/lib/cms/mapper.test.ts` | ❌ Wave 0 |
| DATA-05 | `number_of_certified_beds` mapped correctly | unit | `npx vitest run tests/lib/cms/mapper.test.ts` | ❌ Wave 0 |
| NAME-01 | `provider_name` used, not `legal_business_name` | unit | `npx vitest run tests/lib/cms/mapper.test.ts` | ❌ Wave 0 |
| NAME-02 | Manual override respected; static header unaffected | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ❌ Wave 0 |
| RPT-01 | `assembleHeader('FL')` returns correct static strings | unit | `npx vitest run tests/lib/report/header.test.ts` | ❌ Wave 0 |
| RPT-02 | `assembleViewModel` produces a deterministic model | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ❌ Wave 0 |
| D-05 | `validation_error` response body has zero Zod internals | unit | `npx vitest run tests/api/facility.test.ts` | ❌ Wave 0 |
| D-01 | 5 error kinds map to correct HTTP statuses | unit | `npx vitest run tests/api/facility.test.ts` | ❌ Wave 0 |
| D-19 | Timeout → `network_error` | unit | `npx vitest run tests/lib/cms/client.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per-module commit:** `npx vitest run tests/lib/cms/` or `tests/api/` (by directory)
- **Per-wave merge:** `npm run verify`
- **Phase gate:** `npm run verify:full` (typecheck + lint + format + test + `next build`) must be green

### Wave 0 Gaps (all test files to create)

- [ ] `tests/lib/cms/mapper.test.ts` — covers DATA-01, DATA-03, DATA-04, DATA-05, NAME-01
- [ ] `tests/lib/cms/client.test.ts` — covers D-18, D-19 (fetch stubs); requires `vi.stubGlobal('fetch', ...)`
- [ ] `tests/lib/cms/errors.test.ts` — covers `assertNever` + `CmsError` construction
- [ ] `tests/lib/report/header.test.ts` — covers RPT-01; negative: no facility name in output
- [ ] `tests/lib/report/view-model.test.ts` — covers NAME-02, RPT-02; `generatedAt` as parameter
- [ ] `tests/lib/report/format.test.ts` — covers DATA-03, D-08 through D-11; null→"N/A", not `if (!v)`
- [ ] `tests/api/facility.test.ts` — covers DATA-01, D-01, D-05 (leak invariant); uses `new Request(url)`
- [ ] `tests/api/export-pdf.test.ts` — covers D-21 (400 on bad shape, 501 on valid)

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All server code | ✓ | 26.2.0 | — |
| `AbortSignal.timeout` | D-19 (8s timeout) | ✓ | Native in Node 26 | — |
| `Response.json` | Route handlers | ✓ | Native in Node 26 | — |
| `Request` (Web API) | Test patterns | ✓ | Native in Node 26 | — |
| `zod@4.4.3` | D-03, validation | ✓ | 4.4.3 | — |
| `next@16.2.9` | Route handlers | ✓ | 16.2.9 | — |
| `@react-pdf/renderer` | `serverExternalPackages` config | ✓ (installed Phase 1) | 4.5.1 | — |
| `npm run verify:full` | Phase gate | ✓ | Runs verify + next build | — |

---

## Sources

### Primary (HIGH confidence — verified against installed files)
- `medelite-report/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler API, params-as-Promise, `nextUrl.searchParams`, `Response.json`, segment config, caching defaults
- `medelite-report/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverExternalPackages.md` — `serverExternalPackages` key name, auto-opt-out list (confirms `@react-pdf/renderer`)
- `medelite-report/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/runtime.md` — `export const runtime = 'nodejs'`
- `medelite-report/tests/fixtures/provider-686123.json` — ALL field names verified against this anchor
- `medelite-report/src/lib/cms/schema.ts` — `CMSRowSchema`, `ParsedProvider`, `nullableNum` design
- `medelite-report/src/lib/cms/parse.ts` — `safeParseCMSRow`, Zod v4 `result.error.issues`, `z.prettifyError`
- `medelite-report/vitest.config.ts` — test env, globs, `@/*` alias
- `medelite-report/next.config.ts` — current empty config (target for `serverExternalPackages` change)
- `node -e` live verification — `AbortSignal.timeout`, `URL.searchParams` CMS URL encoding, Zod 4.4.3 discriminated union, `z.prettifyError`, `assertNever` pattern, `NextRequest.nextUrl`, `vi.stubGlobal` fetch pattern

### Secondary (MEDIUM confidence — cited from project planning docs)
- `.planning/research/STACK.md` — CMS API endpoint shape, `=` operator requirement, `{ count, results }` response shape, dataset ID `4pq5-n9py`
- `.planning/research/PITFALLS.md` — Turbopack bug #88844, `middleware.ts` deprecation
- `.planning/research/ARCHITECTURE.md` — module layout structure (field names NOT used; corrected in §3)
- `.planning/phases/02-api-routes-view-model-config/02-CONTEXT.md` — 25 locked decisions

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | CMS API returns `{ count, results }` shape for zero-row query | §6 | Would need to adjust `not_found` detection; easily testable in live call |
| A2 | Vercel's Node.js serverless runtime supports `AbortSignal.timeout` | §6 | Vercel uses Node 20+; `AbortSignal.timeout` added in Node 17.3. Risk is negligible but could fall back to `AbortController` if needed |

If this table were empty, all claims were verified or cited — no user confirmation needed. Both items above have minimal risk given the runtime evidence.

---

## Open Questions

1. **Per-fetch `revalidate` for the CMS call**
   - What we know: NJS16 GET route handlers are dynamic by default (no route-level cache); per-fetch `{ next: { revalidate: N } }` still works independently
   - What's unclear: CONTEXT does not specify a revalidation strategy; D-23 says no auto-retry
   - Recommendation: Omit `next: { revalidate }` for Phase 2 — keep it a pure live proxy. CMS caching is a Phase 3/7 optimization, not a Phase 2 concern.

2. **`CmsError` class vs plain thrown object**
   - What we know: D-18 says "throws a typed `CmsError`"; ARCHITECTURE.md sketches a discriminated union type, not a class
   - What's unclear: Whether `CmsError` should be a custom class (for `instanceof` checks) or a plain thrown object (for simpler mocking)
   - Recommendation: Use a lightweight class `class CmsError extends Error { constructor(public kind: ..., ...) }` — enables `instanceof CmsError` catch in the route handler, avoids catching unrelated errors.

---

## RESEARCH COMPLETE

**Phase:** 2 — API Routes, View Model & Config
**Confidence:** HIGH

### Key Findings

- GET `/api/facility` uses query string (`?ccn=`), not path segment — reads `request.nextUrl.searchParams.get('ccn')`, no `params`. The `await ctx.params` CONTEXT note applies only if a dynamic route is used.
- All 16 fixture field names verified against `provider-686123.json`. ARCHITECTURE.md mapper sketch has 5 wrong field names: `federal_provider_number`, `provider_state`, `provider_city`, `provider_zip_code`, `quality_measure_rating` — all corrected in §3.
- `@react-pdf/renderer` IS on NJS16's auto-opt-out list; D-25 to add it explicitly is correct defensive practice (Turbopack #88844). Key name is `serverExternalPackages` (renamed at v15.0.0).
- NJS16 GET route handlers are **dynamic by default** (no caching) — this is correct behavior for a live CMS proxy. No `export const dynamic = 'force-dynamic'` needed.
- Zod 4.4.3 `z.discriminatedUnion` + `z.infer` + `assertNever` pattern confirmed working. `result.error.issues` (not `.errors`), `z.prettifyError` available.
- `AbortSignal.timeout(8000)` is available in Node 26.2.0 and Vercel's Node 20+ runtime. Abort throws `DOMException('AbortError')` — mock this in timeout tests.

### File Created
`.planning/phases/02-api-routes-view-model-config/02-RESEARCH.md`

### Confidence Assessment
| Area | Level | Reason |
|------|-------|--------|
| NJS16 Route Handler API | HIGH | Verified against installed `route.md` |
| Field names | HIGH | Verified against fixture with `node -e` |
| Zod v4 APIs | HIGH | Tested live against installed Zod 4.4.3 |
| CMS fetch / AbortSignal | HIGH | Runtime-verified in Node 26.2.0 |
| `serverExternalPackages` | HIGH | Verified in installed `serverExternalPackages.md` |
| Test patterns | HIGH | Verified `Request`, `NextRequest`, `vi.stubGlobal` in Node 26 |

### Ready for Planning
Research complete. Planner can now create PLAN.md files.
