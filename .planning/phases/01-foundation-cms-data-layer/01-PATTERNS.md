# Phase 1: Foundation & CMS Data Layer - Pattern Map

**Mapped:** 2026-06-16
**Files analyzed:** 7 (5 new, 1 modify, 1 fixtures dir)
**Analogs found:** 4 / 7 (3 files have no prior analog in this codebase; patterns come from RESEARCH.md verified code)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `medelite-report/scripts/capture-fixture.ts` | utility/script | file-I/O + request-response | `medelite-report/scripts/capture-fixture.ts` (current no-op) | self (modify) |
| `medelite-report/src/lib/cms/schema.ts` | utility/validation | transform | none in codebase | no analog — use RESEARCH.md |
| `medelite-report/src/lib/cms/parse.ts` | utility | transform | none in codebase | no analog — use RESEARCH.md |
| `medelite-report/tests/lib/cms/schema.test.ts` | test | batch | `medelite-report/tests/smoke.test.ts` | role-match |
| `medelite-report/tests/fixtures/provider-686123.json` | fixture | — | none (first fixture) | no analog |
| `medelite-report/tests/fixtures/claims-686123.json` | fixture | — | none (first fixture) | no analog |
| `medelite-report/tests/fixtures/averages-xcdc.json` | fixture | — | none (first fixture) | no analog |

---

## Pattern Assignments

### `medelite-report/scripts/capture-fixture.ts` (utility/script, file-I/O + request-response)

**Analog:** Self — the existing no-op at `medelite-report/scripts/capture-fixture.ts`

**Current file structure** (lines 1-11 — replace entirely):
```typescript
// Fixture capture entrypoint, run via `npm run fixture:capture` (tsx).
export function captureFixtures(): void {
  console.log("No fixtures configured yet.");
}

captureFixtures();
```

**Module contract to preserve:**
- File must export at least one symbol (satisfies `isolatedModules` — every `.ts` must have `import`/`export`).
- File must call `captureFixtures()` at the bottom so `tsx scripts/capture-fixture.ts` runs without arguments.
- Script is invoked via `npm run fixture:capture` (wired in `package.json` as `tsx scripts/capture-fixture.ts`).

**Node.js import pattern to follow** (from `scripts/verify.mjs` lines 8):
```javascript
import { spawnSync } from "node:child_process";
```
Use the `node:` prefix for all Node built-in imports — this is the established convention in `scripts/`.

**Imports pattern (Node built-ins — follow verify.mjs convention):**
```typescript
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
```

**Dataset registry pattern** (RESEARCH.md Priority-2 verified pattern):
```typescript
interface DatasetCapture {
  datasetId: string
  outputFile: string
  filter?: { property: string; value: string }
  multiFilter?: Array<{ property: string; value: string }>
}

const REGISTRY: DatasetCapture[] = [
  {
    datasetId: '4pq5-n9py',
    outputFile: 'provider-686123.json',
    filter: { property: 'cms_certification_number_ccn', value: '686123' },
  },
  {
    datasetId: 'ijh5-nb2v',
    outputFile: 'claims-686123.json',
    filter: { property: 'cms_certification_number_ccn', value: '686123' },
  },
  {
    datasetId: 'xcdc-v8bm',
    outputFile: 'averages-xcdc.json',
    multiFilter: [
      { property: 'state_or_nation', value: 'NATION' },
      { property: 'state_or_nation', value: 'FL' },
    ],
  },
]
```

**CMS fetch helper pattern** (RESEARCH.md Priority-2 — verified live 2026-06-16):
```typescript
const BASE = 'https://data.cms.gov/provider-data/api/1/datastore/query'

async function queryCMS(datasetId: string, property: string, value: string) {
  const url = new URL(`${BASE}/${datasetId}/0`)
  url.searchParams.set('conditions[0][property]', property)
  url.searchParams.set('conditions[0][value]', value)
  url.searchParams.set('conditions[0][operator]', '=')  // single = not ==; == returns HTTP 400
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`CMS ${res.status} for dataset=${datasetId}`)
  const json = await res.json() as { results: unknown[]; count: number }
  if (json.count === 0) throw new Error(`Zero results: ${datasetId} / ${property}=${value}`)
  return json.results
}
```

**Directory creation pattern** (RESEARCH.md Pitfall-5 — `tests/fixtures/` does not exist):
```typescript
mkdirSync(FIXTURES_DIR, { recursive: true })  // must precede any writeFileSync call
```

**`averages-xcdc.json` output shape** (RESEARCH.md Assumption A3):
```typescript
// Store as keyed object for Phase 5 ease of access: averages['NATION'], averages['FL']
const averagesOutput: Record<string, unknown> = {}
for (const row of multiFilterRows) {
  const key = (row as Record<string, unknown>)['state_or_nation'] as string
  averagesOutput[key] = row
}
writeFileSync(outputPath, JSON.stringify(averagesOutput, null, 2))
```

---

### `medelite-report/src/lib/cms/schema.ts` (utility/validation, transform)

**Analog:** None in codebase. Implement against RESEARCH.md verified patterns and the captured `tests/fixtures/provider-686123.json`.

**No analog note:** The project has no existing Zod schemas or validation modules. The patterns below come exclusively from RESEARCH.md verified live execution with `zod@4.4.3`.

**Imports pattern:**
```typescript
import { z } from 'zod'
```

**`isolatedModules` requirement** (from `tsconfig.json` line 13 — every `.ts` must have import/export):
This file satisfies it via the `import { z } from 'zod'` and two named exports (`CMSRowSchema`, `ParsedProvider`).

**`@/*` path alias** (from `tsconfig.json` line 22 — `@/*` maps to `./src/*`):
Files under `src/lib/cms/` are reachable as `@/lib/cms/schema` from other `src/` files. Use this alias when importing from other src files in Phase 2+.

**Empty-string → null helper pattern** (RESEARCH.md Zod v4 section — verified live):
```typescript
// Verified working in zod@4.4.3 — handles D-08/D-09
const nullableNum = z.preprocess(
  (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
  z.coerce.number().nullable()
)
// Behaviors:
// ''    → null  (suppressed CMS field, D-08)
// '   ' → null  (whitespace-only)
// '0'   → 0     (real zero preserved, D-09)
// '5'   → 5     (normal value)
// null  → null  (pass-through)
```

**Schema shape pattern** (RESEARCH.md Code Examples — verified against live field names):
```typescript
export const CMSRowSchema = z
  .object({
    // Identity/text fields — stay as strings (D-10: no coercion on CCN/ZIP)
    cms_certification_number_ccn: z.string(),   // field verified live: "686123"
    zip_code: z.string(),
    provider_name: z.string(),
    legal_business_name: z.string(),
    provider_address: z.string(),
    citytown: z.string(),
    state: z.string(),

    // Numeric — coerced from string (D-07); empty → null before coerce (D-08)
    number_of_certified_beds: nullableNum,

    // Star ratings — required keys, nullable values (D-05/D-06)
    overall_rating: nullableNum,
    health_inspection_rating: nullableNum,
    qm_rating: nullableNum,          // Quality of Resident Care — NOT longstay_qm_rating
    staffing_rating: nullableNum,

    processing_date: z.string(),
  })
  .passthrough()  // D-04: ~90 other CMS columns pass through untouched

export type ParsedProvider = z.infer<typeof CMSRowSchema>
```

**Key constraints to enforce:**
- `qm_rating` is the correct field (NOT `longstay_qm_rating` / `shortstay_qm_rating`) per CLAUDE.md field mapping.
- `cms_certification_number_ccn` and `zip_code` use `z.string()` — never `z.coerce.number()` (D-10).
- All depended-on fields are **required keys** with nullable values — not `z.optional()` (D-05/D-06).
- `.passthrough()` is mandatory (D-04) — CMS rows have ~100 columns.

---

### `medelite-report/src/lib/cms/parse.ts` (utility, transform)

**Analog:** None in codebase.

**Imports pattern** (follows `@/*` alias for cross-module imports):
```typescript
import { z } from 'zod'
import { CMSRowSchema, type ParsedProvider } from '@/lib/cms/schema'
```

**Safe parse with Zod v4 error access** (RESEARCH.md — breaking change from v3):
```typescript
// CORRECT — Zod v4: use result.error.issues (not result.error.errors — undefined in v4)
export function parseCMSRow(raw: unknown): ParsedProvider {
  const result = CMSRowSchema.safeParse(raw)
  if (!result.success) {
    throw new Error(z.prettifyError(result.error))
    // result.error.issues — ZodIssue[] if you need structured access
    // result.error.errors — UNDEFINED in v4; do not use
  }
  return result.data
}

// Non-throwing variant for callers that want to handle errors:
export function safeParseCMSRow(raw: unknown) {
  return CMSRowSchema.safeParse(raw)
}
```

**`isolatedModules` requirement:** satisfied by the `import` statements above.

---

### `medelite-report/tests/lib/cms/schema.test.ts` (test, batch)

**Analog:** `medelite-report/tests/smoke.test.ts`

**Test file structure pattern** (smoke.test.ts lines 1-9 — mirror exactly):
```typescript
import { describe, expect, it } from "vitest";

describe("CMSRowSchema", () => {
  it("description of behavior", () => {
    expect(actual).toBe(expected);
  });
});
```

**Key conventions from smoke.test.ts:**
- Import `describe`, `expect`, `it` from `"vitest"` (not `@vitest/test` or `vitest/globals`).
- Double quotes for import strings — matches prettier config in this project.
- No `beforeEach`/`afterEach` in the smoke test — keep test setup local to each `it` block for fixture-based tests.

**`isolatedModules` requirement:** satisfied by `import { describe, expect, it } from "vitest"`.

**Fixture import pattern** (`tsconfig.json` line 12 — `resolveJsonModule: true`):
```typescript
// Happy-path fixture: import directly (TypeScript infers type from JSON shape)
import providerFixture from "../../fixtures/provider-686123.json";

// Malformed fixtures: declare as `unknown` to avoid TypeScript inferring wrong types
// (RESEARCH.md Pitfall-6)
import rawMalformed from "../../fixtures/malformed/missing-required-key.json";
const malformed: unknown = rawMalformed;
```

**Required test cases** (from CONTEXT.md decisions + RESEARCH.md test map — D-11/D-12):
```typescript
// 1. Happy path: captured fixture parses successfully
it("parses the 686123 provider fixture successfully", () => {
  const result = CMSRowSchema.safeParse(providerFixture[0]);
  expect(result.success).toBe(true);
});

// 2. Suppressed empty-string → null (not 0) — the D-08 landmine
it("maps suppressed empty-string rating to null, not 0", () => {
  const row = { /* ...valid fields..., */ overall_rating: "" };
  const result = CMSRowSchema.safeParse(row);
  expect(result.success).toBe(true);
  if (result.success) expect(result.data.overall_rating).toBeNull();
});

// 3. Real "0" is preserved as 0 (D-09)
it('preserves "0" as 0, not null', () => {
  const row = { /* ...valid fields..., */ overall_rating: "0" };
  const result = CMSRowSchema.safeParse(row);
  expect(result.success).toBe(true);
  if (result.success) expect(result.data.overall_rating).toBe(0);
});

// 4. Missing required key fails loudly (D-05)
it("fails safeParse when a required key is missing", () => {
  const result = CMSRowSchema.safeParse(malformed);
  expect(result.success).toBe(false);
  // Zod v4: access result.error.issues (not result.error.errors)
  if (!result.success) expect(result.error.issues.length).toBeGreaterThan(0);
});

// 5. CCN and ZIP preserve leading zeros as strings (D-10)
it("preserves leading zeros in CCN as a string", () => {
  const row = { /* ...valid fields..., */ cms_certification_number_ccn: "056789" };
  const result = CMSRowSchema.safeParse(row);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.cms_certification_number_ccn).toBe("056789");
  }
});
```

**Vitest path resolution:** test file lives at `tests/lib/cms/schema.test.ts`; fixtures are at `tests/fixtures/`. Relative path from test to fixture: `../../fixtures/`.

**Run command:** `npx vitest run tests/lib/cms/schema.test.ts` (from `medelite-report/`).

---

### `medelite-report/tests/fixtures/*.json` (fixtures)

**Analog:** None — first fixtures in the project.

**Output shape for `provider-686123.json`** (RESEARCH.md Priority-2 + ROADMAP SC#1 required path):
```json
[
  {
    "cms_certification_number_ccn": "686123",
    "provider_name": "KENDALL LAKES HEALTHCARE AND REHAB CENTER",
    ...
  }
]
```
Store as the full `results` array from the CMS API response (single-element array). Tests import `fixture[0]` to get the row object.

**Output shape for `claims-686123.json`:**
```json
[
  { "measure_code": "521", "adjusted_score": "25.575578", ... },
  { "measure_code": "522", "adjusted_score": "8.094575", ... },
  { "measure_code": "551", "adjusted_score": "2.752503", ... },
  { "measure_code": "552", "adjusted_score": "0.910105", ... }
]
```
Store as the full `results` array (4 elements). Phase 5 imports and schemas this.

**Output shape for `averages-xcdc.json`:**
```json
{
  "NATION": { "state_or_nation": "NATION", "percentage_of_short_stay_residents_who_were_rehospitalized__1d02": "23.875617", ... },
  "FL": { "state_or_nation": "FL", "percentage_of_short_stay_residents_who_were_rehospitalized__1d02": "26.203324", ... }
}
```
Store as keyed object (not array) — Phase 5 accesses `averages['NATION']` without filtering.

**Malformed fixtures** (RESEARCH.md Pitfall-6 recommendation — define as inline `const` in schema.test.ts to avoid JSON type-inference issues):
```typescript
// In schema.test.ts — inline malformed fixtures as typed constants
const missingRequiredKey: unknown = {
  provider_name: "Test Facility",
  overall_rating: "4"
  // deliberately missing cms_certification_number_ccn
}

const suppressedRow: unknown = {
  cms_certification_number_ccn: "000001",
  provider_name: "New Facility",
  provider_address: "123 Main St",
  citytown: "Anytown",
  state: "TX",
  zip_code: "75001",
  number_of_certified_beds: "30",
  overall_rating: "",
  health_inspection_rating: "",
  qm_rating: "",
  staffing_rating: "",
  legal_business_name: "New Facility LLC",
  processing_date: "2026-01-01"
}

const wrongShape: unknown = {
  error: "invalid_ccn",
  message: "No matching records"
}
```

If the planner prefers file-based malformed fixtures (`tests/fixtures/malformed/*.json`), they must be imported as `unknown` in the test (see RESEARCH.md Pitfall-6 pattern above). Inline constants are simpler and avoid the type-inference edge case.

---

## Shared Patterns

### `isolatedModules` — every `.ts` must have import or export

**Source:** `medelite-report/tsconfig.json` line 13
**Apply to:** All new `.ts` files in Phase 1

Every `.ts` file must contain at least one `import` or `export` statement, or TypeScript will error under `isolatedModules: true`. The existing `capture-fixture.ts` satisfies this with `export function captureFixtures()`. New files satisfy it via their `import` statements.

### `"double quotes"` string convention

**Source:** `medelite-report/tests/smoke.test.ts` (lines 1, 3-9) + `medelite-report/src/app/layout.tsx` (observed throughout)
**Apply to:** All new `.ts` / `.tsx` files

Prettier is configured and enforced by `npm run format:check`. The existing code uses double quotes throughout. New files must use double quotes for string literals (or Prettier will reformat them — either is fine as long as `format:check` passes).

### Zod v4 error access — `result.error.issues` not `result.error.errors`

**Source:** RESEARCH.md Zod v4 section — verified live with `zod@4.4.3` 2026-06-16
**Apply to:** `schema.ts`, `parse.ts`, `schema.test.ts`

```typescript
// CORRECT — v4:
result.error.issues          // ZodIssue[]
z.prettifyError(result.error) // human-readable string

// BROKEN — v3 pattern, undefined in v4:
result.error.errors          // DO NOT USE
```

### `node:` prefix for Node built-in imports

**Source:** `medelite-report/scripts/verify.mjs` line 8: `import { spawnSync } from "node:child_process"`
**Apply to:** `scripts/capture-fixture.ts`

```typescript
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
```

### `@/*` path alias for src-to-src imports

**Source:** `medelite-report/tsconfig.json` lines 22-24
**Apply to:** `src/lib/cms/parse.ts` importing from `src/lib/cms/schema.ts`

```typescript
// Correct: use alias for imports between src/ files
import { CMSRowSchema } from '@/lib/cms/schema'

// Avoid: relative paths from src/ to src/ — fragile on moves
import { CMSRowSchema } from '../schema'
```

Note: scripts in `scripts/` are NOT under `src/`, so `@/*` alias does not apply to `capture-fixture.ts`. Use relative paths or `node:path` + `process.cwd()` there.

### Verify gate must stay green

**Source:** `medelite-report/scripts/verify.mjs` — runs `typecheck → lint → format:check → test` sequentially
**Apply to:** Every task in Phase 1

Run `npx vitest run tests/lib/cms/schema.test.ts` after each schema/test edit. Run `npm run verify` before marking any task complete. A task is not done while the gate is red (CLAUDE.md rule #1).

---

## No Analog Found

Files with no close match in the codebase (planner uses RESEARCH.md patterns directly):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/lib/cms/schema.ts` | utility/validation | transform | No Zod schemas exist in this codebase yet; this is the first |
| `src/lib/cms/parse.ts` | utility | transform | No lib modules exist in this codebase yet; this is the first |
| `tests/fixtures/*.json` | fixture | — | No fixture files exist in this codebase yet; this is the first |

For these files, RESEARCH.md Code Examples section provides the verified implementation patterns (live-tested with `zod@4.4.3` and the live CMS API on 2026-06-16).

---

## Metadata

**Analog search scope:** `medelite-report/scripts/`, `medelite-report/src/`, `medelite-report/tests/`
**Files scanned:** 10 (capture-fixture.ts, verify.mjs, smoke.test.ts, tsconfig.json, vitest.config.ts, package.json, next.config.ts, eslint.config.mjs, layout.tsx, page.tsx)
**No lib/, services/, components/ or test-utility files exist yet** — project is a fresh Next.js scaffold
**Pattern extraction date:** 2026-06-16
