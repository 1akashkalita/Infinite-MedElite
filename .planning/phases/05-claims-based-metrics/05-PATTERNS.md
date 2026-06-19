# Phase 5: Claims-Based Metrics - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 15 (7 new, 8 modified)
**Analogs found:** 15 / 15

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/cms/claims-schema.ts` | schema/validator | transform | `src/lib/cms/schema.ts` | exact |
| `src/lib/cms/averages-schema.ts` | schema/validator | transform | `src/lib/cms/schema.ts` | exact |
| `src/lib/cms/claims-mapper.ts` | mapper/transform | transform | `src/lib/cms/mapper.ts` | exact |
| `src/lib/cms/constants.ts` | config | — | itself (add constants) | exact |
| `src/lib/cms/client.ts` | service | request-response | itself (`fetchFacility`) | exact |
| `src/lib/cms/types.ts` | model | — | itself (`FacilityData`) | exact |
| `src/lib/report/view-model.ts` | model/validator | — | itself (`ReportViewModelSchema`) | exact |
| `src/lib/report/format.ts` | utility | transform | itself (`formatPercent`/`formatRate`) | exact |
| `src/app/api/facility/route.ts` | route/controller | request-response | itself (current GET) | exact |
| `src/components/ReportPreview.tsx` | component | request-response | itself (existing `<dl>`) | exact |
| `src/components/pdf/ReportPDF.tsx` | component | request-response | itself (existing flexbox rows) | exact |
| `tests/lib/cms/claims-schema.test.ts` | test | — | `tests/lib/cms/schema.test.ts` | exact |
| `tests/lib/cms/averages-schema.test.ts` | test | — | `tests/lib/cms/schema.test.ts` | exact |
| `tests/lib/cms/claims-mapper.test.ts` | test | — | `tests/lib/cms/mapper.test.ts` | exact |
| `tests/lib/report/format.test.ts` | test (extend) | — | itself (existing `formatPercent`/`formatRate` tests) | exact |

---

## Pattern Assignments

### `src/lib/cms/claims-schema.ts` (NEW — schema/validator)

**Analog:** `src/lib/cms/schema.ts`

**Imports pattern** (schema.ts lines 14):
```typescript
import { z } from "zod";
```

**nullableNum helper** (schema.ts lines 23–39) — copy verbatim; this is the canonical pattern for all CMS numeric string fields:
```typescript
// Helper: validate a CMS numeric field. CMS returns these as strings (often "" when
// suppressed), as a real number, or null — never as a boolean/array/object.
// Behaviors:  ""/"   " → null  |  "0" → 0  |  "5" → 5  |  null → null  |  5 → 5
const nullableNum = z
  .union([z.string(), z.number(), z.null()])
  .transform((v, ctx) => {
    if (v === null) return null;
    if (typeof v === "number") return v;
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      ctx.addIssue({
        code: "custom",
        message: `Expected a numeric string, got "${v}"`,
      });
      return z.NEVER;
    }
    return n;
  });
```

**Core schema pattern** (schema.ts lines 41–68) — replace with claims-specific fields. Key decisions to preserve: `.passthrough()` on the object, required string fields for identity, `nullableNum` for the numeric score:
```typescript
// CMSRowSchema structure to mirror:
export const CMSRowSchema = z
  .object({
    cms_certification_number_ccn: z.string(),          // identity — stays string
    // ... required string and nullableNum fields ...
    overall_rating: nullableNum,                        // numeric string → number | null
  })
  .passthrough(); // D-04: unmodeled columns pass through untouched

export type ParsedProvider = z.infer<typeof CMSRowSchema>;
```

**Claims-specific schema** (from RESEARCH.md Code Examples — verified against `claims-686123.json`):
```typescript
// Field names verified against tests/fixtures/claims-686123.json (CLAUDE.md rule #3)
export const ClaimsRowSchema = z
  .object({
    cms_certification_number_ccn: z.string(),
    measure_code: z.string(),           // "521" | "522" | "551" | "552"
    measure_description: z.string(),
    resident_type: z.string(),
    adjusted_score: nullableNum,        // coerce "" → null; "25.575578" → 25.575578
    footnote_for_score: z.string(),     // "" when no suppression; footnote code when suppressed
    processing_date: z.string(),
  })
  .passthrough();

export type ClaimsRow = z.infer<typeof ClaimsRowSchema>;
```

---

### `src/lib/cms/averages-schema.ts` (NEW — schema/validator)

**Analog:** `src/lib/cms/schema.ts`

**Same nullableNum import and helper pattern** — replicate the helper from schema.ts lines 23–39 verbatim (or import it if it is extracted to a shared location).

**Core schema** (from RESEARCH.md Code Examples + fixture verification). Critical decision: `.passthrough()` on the ENTIRE schema because the 2 percentage columns have unstable hash suffixes and must not be hardcoded as required keys. The mapper does runtime key scan:
```typescript
// Field names verified against tests/fixtures/averages-xcdc.json (CLAUDE.md rule #3)
// state_or_nation = "NATION" or 2-letter state code (e.g. "FL")
export const AveragesRowSchema = z
  .object({
    state_or_nation: z.string(),
    processing_date: z.string(),
  })
  .passthrough(); // ALL other columns pass through — mapper does description-based key scan

export type AveragesRow = z.infer<typeof AveragesRowSchema>;
```

---

### `src/lib/cms/claims-mapper.ts` (NEW — mapper/transform)

**Analog:** `src/lib/cms/mapper.ts`

**Imports pattern** (mapper.ts lines 13–14):
```typescript
import type { ParsedProvider } from "@/lib/cms/schema";
import type { FacilityData } from "@/lib/cms/types";
```
Mirror with claims-specific types:
```typescript
import type { ClaimsRow } from "@/lib/cms/claims-schema";
import type { AveragesRow } from "@/lib/cms/averages-schema";
import type { HospMetric } from "@/lib/cms/types";
```

**Core mapping pattern** (mapper.ts lines 27–63) — pure function, single CMS→domain boundary. The claims mapper returns an array of 12 `HospMetric` objects. Same discipline: no CMS snake_case field names anywhere except inside this mapper.

**Average column description-to-value lookup** (RESEARCH.md Pattern 3 + verified fixture keys lines 49–52 of averages-xcdc.json):
```typescript
// The mapper scans the AveragesRow's keys at runtime to find the one whose name
// contains the target description substring. This handles slug hash rotation (D-14).
// Description substrings verified against tests/fixtures/averages-xcdc.json:
const AVERAGE_COLUMN_DESCRIPTIONS: Record<string, string> = {
  '521': 'rehospitalized',      // → percentage_of_short_stay_residents_who_were_rehospitalized__1d02
  '522': 'outpatient_em',       // → percentage_of_short_stay_residents_who_had_an_outpatient_em_d911
  '551': 'hospitalizations_per_1000_longstay',  // → number_of_hospitalizations_per_1000_longstay_resident_days
  '552': 'outpatient_emergency_department_visits_per_1000_l',  // → number_of_outpatient_emergency_department_visits_per_1000_l_de9d
};
```

**METRIC_DEFINITIONS constant** — hard-coded in this file; verbatim labels from CONTEXT.md `<specifics>` (D-04). Planner builds from the 12-row table:
```typescript
const METRIC_DEFINITIONS = [
  { label: 'Short Term Hospitalization',                  measureCode: '521', source: 'facility', unit: 'percent' },
  { label: 'STR National Avg. for Hospitalization',       measureCode: '521', source: 'nation',   unit: 'percent' },
  { label: 'STR State National Avg. for Hospitalization', measureCode: '521', source: 'state',    unit: 'percent' },
  { label: 'STR ED Visit',                                measureCode: '522', source: 'facility', unit: 'percent' },
  { label: 'STR ED Visits National Avg.',                 measureCode: '522', source: 'nation',   unit: 'percent' },
  { label: 'STR ED Visits State Avg.',                    measureCode: '522', source: 'state',    unit: 'percent' },
  { label: 'LT Hospitalization',                          measureCode: '551', source: 'facility', unit: 'rate'    },
  { label: 'LT National Avg. for Hospitalization',        measureCode: '551', source: 'nation',   unit: 'rate'    },
  { label: 'LT State National Avg. for Hospitalization',  measureCode: '551', source: 'state',    unit: 'rate'    },
  { label: 'ED Visit',                                    measureCode: '552', source: 'facility', unit: 'rate'    },
  { label: 'LT ED Visits National Avg.',                  measureCode: '552', source: 'nation',   unit: 'rate'    },
  { label: 'LT ED Visits State Avg.',                     measureCode: '552', source: 'state',    unit: 'rate'    },
] as const;
```

**Function signature** (pure, deterministic — mirrors `toFacilityData`'s pure-function discipline):
```typescript
export function joinClaimsAndAverages(
  claimsRows: ClaimsRow[],
  nationRow: AveragesRow,
  stateRow: AveragesRow,
): HospMetric[] | undefined
// Returns undefined when fewer than 4 measures present (triggers D-09 degraded line)
```

---

### `src/lib/cms/constants.ts` (MODIFIED — add 3 constants)

**Analog:** itself (existing 3 constants at lines 14–30)

**Existing pattern** (constants.ts lines 10–30) — each constant has a JSDoc comment tracing it to the fixture/metastore (CLAUDE.md rule #3):
```typescript
/**
 * Provider Information dataset ID.
 * Verified against CMS metastore in scripts/capture-fixture.ts REGISTRY and
 * confirmed by tests/fixtures/provider-686123.json (captured from this dataset).
 */
export const DATASET_PROVIDER_INFO = "4pq5-n9py";

/**
 * The CCN filter field name in dataset 4pq5-n9py.
 * Verified in tests/fixtures/provider-686123.json (top-level key) and
 * scripts/capture-fixture.ts REGISTRY filter property.
 */
export const CCN_FILTER_FIELD = "cms_certification_number_ccn";
```

**New constants to add** (append after existing 3, same JSDoc traceability pattern):
```typescript
/**
 * Medicare Claims Quality Measures dataset ID.
 * Verified via CMS metastore 2026-06-18. Provides 4 facility adjusted scores.
 */
export const DATASET_CLAIMS = "ijh5-nb2v";

/**
 * State/US Averages dataset ID.
 * Verified via CMS metastore 2026-06-18. Provides national + state averages for 4 measures.
 */
export const DATASET_AVERAGES = "xcdc-v8bm";

/**
 * The key field in xcdc-v8bm used to filter NATION / state rows.
 * Verified in tests/fixtures/averages-xcdc.json (top-level key of each row).
 */
export const AVERAGES_FILTER_FIELD = "state_or_nation";
```

---

### `src/lib/cms/client.ts` (MODIFIED — add fetchClaimsMeasures + fetchAverages)

**Analog:** itself — `fetchFacility` (lines 41–124) is the exact pattern to replicate for both new fetchers.

**Full fetchFacility pattern** (client.ts lines 41–124) — the SSRF/timeout/Zod discipline to replicate verbatim:
```typescript
export async function fetchFacility(ccn: string): Promise<FacilityData> {
  // 1. Build URL: host+path from fixed constants; user input ONLY as a condition VALUE
  const url = new URL(`${CMS_BASE_URL}/${DATASET_PROVIDER_INFO}/0`);
  url.searchParams.set("conditions[0][property]", CCN_FILTER_FIELD);
  url.searchParams.set("conditions[0][value]", ccn);
  url.searchParams.set("conditions[0][operator]", "=");
  url.searchParams.set("limit", "1");

  // 2. Fetch with 8s timeout
  let resp: Response;
  try {
    resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new CmsError("network_error", "CMS data is unavailable — please try again.");
  }

  // 3. Non-200 → cms_api_error
  if (!resp.ok) {
    throw new CmsError("cms_api_error", "CMS returned an error — please try again.");
  }

  // 4. JSON parse — catch malformed body
  let json: { count?: number; results?: unknown };
  try {
    json = (await resp.json()) as { count?: number; results?: unknown };
  } catch {
    throw new CmsError("cms_api_error", "CMS returned an error — please try again.");
  }

  // 5. Envelope guard
  if (!Array.isArray(json.results)) {
    throw new CmsError("cms_api_error", "CMS returned an error — please try again.");
  }

  // 6. Zod validate each row; map to domain type
  const parseResult = safeParseCMSRow(results[0]);
  if (!parseResult.success) {
    console.error(`[validation_error] CCN=${ccn}`, z.prettifyError(parseResult.error));
    throw new CmsError("validation_error", "We couldn't read this facility's data right now.");
  }
  return toFacilityData(parseResult.data);
}
```

**fetchClaimsMeasures differences from fetchFacility:**
- Uses `DATASET_CLAIMS` instead of `DATASET_PROVIDER_INFO`
- `limit` = `"10"` (4 expected; headroom)
- Returns `ClaimsRow[]` not a single object
- Validate each row with `ClaimsRowSchema.safeParse(r)` in a `.flatMap()` (graceful partial — drop invalid rows, keep valid ones)
- No `not_found` case — returns empty array if 0 rows (route handler interprets this as degraded)

**fetchAverages differences from fetchFacility:**
- Uses `DATASET_AVERAGES`; filter field is `AVERAGES_FILTER_FIELD`; takes two `state_or_nation` values: `"NATION"` and the facility state (e.g. `"FL"`)
- Returns `{ nation: AveragesRow; state: AveragesRow }` or throws `CmsError`
- No CCN filter — uses two separate fetch calls or one fetch with no CCN condition but `conditions[0][property]=state_or_nation`, `conditions[0][value]=NATION` etc.

---

### `src/lib/cms/types.ts` (MODIFIED — add HospMetric + HospMetricsResult)

**Analog:** itself — `FacilityData` interface (lines 23–59) is the model to follow.

**Existing interface pattern** (types.ts lines 23–59) — camelCase, JSDoc field comments tracing to CMS source:
```typescript
export interface FacilityData {
  /** CMS certification number — preserved as string (leading zeros). */
  ccn: string;
  /** ... */
  starRatings: {
    overall: number | null;
    // ...
  };
}
```

**New interfaces to add:**
```typescript
/**
 * A single hospitalization/ED data point (one of the 12 rows).
 * Source: joinClaimsAndAverages() in claims-mapper.ts (Phase 5).
 */
export interface HospMetric {
  /** Verbatim label from the reference template (D-04 — garbles preserved). */
  label: string;
  /** Facility adjusted score or average value. null when CMS suppressed the value. */
  value: number | null;
  /** Formatter kind: "percent" → formatPercent, "rate" → formatRate (D-12). */
  unit: "percent" | "rate";
  /** CMS footnote code string (D-11). Empty string or absent = not suppressed. */
  footnoteCode?: string;
}
```

---

### `src/lib/report/view-model.ts` (MODIFIED — replace hospMetrics stub)

**Analog:** itself — `ReportViewModelSchema` (lines 49–126) shows where the replacement goes and the surrounding field pattern.

**Current stub to replace** (view-model.ts line 125):
```typescript
hospMetrics: z.unknown().optional(),
```

**Replacement pattern** — add `HospMetricSchema` inline above `ReportViewModelSchema`, then reference it. Keep `.optional()` (D-13):
```typescript
// HospMetricSchema — validates one of the 12 hospitalization/ED data points.
// Added in Phase 5 (D-13). Must live inside ReportViewModelSchema because
// POST /api/export/pdf re-validates the full posted view-model.
const HospMetricSchema = z.object({
  label: z.string(),
  value: z.number().nullable(),
  unit: z.enum(["percent", "rate"]),
  footnoteCode: z.string().optional(),
});

// Inside ReportViewModelSchema:
hospMetrics: z.array(HospMetricSchema).optional(),
// — optional so degraded response (D-09) validates (absent = show one-line message)
// — NO .min(12).max(12): Zod v4 has no .length() on ZodArray; length enforced by mapper
```

**assembleViewModel signature change** (lines 146–150) — add optional `hospMetrics` parameter and thread it through:
```typescript
export function assembleViewModel(
  facility: FacilityData,
  manual: ManualInputs,
  generatedAt: Date | string,
  hospMetrics?: HospMetric[],        // NEW — optional; absent = degraded state
): ReportViewModel
// Return object adds:
//   hospMetrics,  // passed through directly; undefined when not supplied
```

---

### `src/lib/report/format.ts` (MODIFIED — add formatFootnote)

**Analog:** itself — `formatPercent` and `formatRate` (lines 37–48) show the pattern.

**Existing formatter pattern** (format.ts lines 37–48) — null-safe, `=== null` check (never falsiness), single-line return:
```typescript
export function formatPercent(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return `${value.toFixed(1)}%`;
}

export function formatRate(value: number | null): string {
  if (value === null) return PLACEHOLDER;
  return value.toFixed(2);
}
```

**formatFootnote to add** (append after existing formatters — same file, same module):
```typescript
// FOOTNOTE_MESSAGES — traced to NH_Data_Dictionary Table 15 (CLAUDE.md rule #3 / D-11).
// FEATURES.md Table 15 is the intermediate citation.
const FOOTNOTE_MESSAGES: Record<string, string> = {
  '1':  'Not enough data',
  '2':  'Not enough data',
  '7':  'Not available',
  '9':  'Not reported (small sample)',
  '10': 'Not submitted',
  '28': 'Not enough data (annual measure)',
};
const FOOTNOTE_FALLBACK = 'Not available';

/**
 * Maps a CMS footnote code to a human-readable suppression message (D-11).
 * Returns a safe generic message for unknown codes or empty/absent footnote.
 */
export function formatFootnote(footnoteCode: string | undefined): string {
  if (!footnoteCode || footnoteCode === '') return FOOTNOTE_FALLBACK;
  return FOOTNOTE_MESSAGES[footnoteCode] ?? FOOTNOTE_FALLBACK;
}
```

**renderMetricValue helper** — add as a module-level function here OR co-locate in the component files. Pattern from RESEARCH.md:
```typescript
// Used at render time in ReportPreview + ReportPDF (not exported from format.ts — inline at call site)
function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === 'percent' ? formatPercent(m.value) : formatRate(m.value);
}
```

---

### `src/app/api/facility/route.ts` (MODIFIED — 3-dataset fan-out)

**Analog:** itself — existing `GET` handler (lines 36–122) shows the structure to extend.

**Existing handler structure** (route.ts lines 36–122):
```typescript
export async function GET(request: NextRequest) {
  // 1. Read + normalize + gate CCN (lines 38–68)
  // 2. try { fetchFacility → Response.json({ data }) } catch (CmsError) { switch(err.kind) → error responses }
}
```

**Extension pattern** — after `fetchFacility` resolves (hard dependency), fan out to the two soft dependencies:
```typescript
// After CCN gate (lines 38-68), EXTEND the try block:
const facility = await fetchFacility(ccn);   // hard dependency — throws on failure (unchanged)

// Fan-out: claims + averages in parallel with Promise.allSettled (D-07)
// fetchAverages needs facility.state which is now resolved.
const [claimsResult, averagesResult] = await Promise.allSettled([
  fetchClaimsMeasures(ccn),
  fetchAverages(facility.state),
]);

// Join: both must succeed; if either failed, hospMetrics is absent (degraded state D-09)
let hospMetrics: HospMetric[] | undefined;
if (claimsResult.status === 'fulfilled' && averagesResult.status === 'fulfilled') {
  hospMetrics = joinClaimsAndAverages(
    claimsResult.value,
    averagesResult.value.nation,
    averagesResult.value.state,
  ) ?? undefined;
}

// assemble vm with hospMetrics (may be undefined)
const vm = assembleViewModel(facility, manual, new Date(), hospMetrics);
return Response.json({ data: vm }, { status: 200 });
```

**The existing CmsError switch** (lines 80–120) remains unchanged — it only handles `fetchFacility` failures. `fetchClaimsMeasures` / `fetchAverages` failures are absorbed by `Promise.allSettled` (they never reach the switch).

---

### `src/components/ReportPreview.tsx` (MODIFIED — append 12 rows inside `<dl>`)

**Analog:** itself — existing `<dl>` body rows (lines 118–194) are the exact pattern to continue.

**Existing row pattern** (ReportPreview.tsx lines 120–121 and 127):
```tsx
<dt className="font-semibold text-zinc-700">Name of Facility</dt>
<dd className="text-zinc-900">{vm.facility.displayName}</dd>
```

**Import change** — add `formatFootnote` and type import for `HospMetric`:
```tsx
import { formatRating, formatBeds, formatLocation, formatDate, formatFootnote } from "@/lib/report/format";
import type { HospMetric } from "@/lib/cms/types";
```

**Append after row 13 inside the `<dl>`** (after line 193 `</dd>` closing "Quality of Resident Care", before line 194 `</dl>`):
```tsx
{/* Rows 14–25: 12 hospitalization/ED metric rows (Phase 5 / D-03/D-05) */}
{vm.hospMetrics === undefined ? (
  <React.Fragment>
    <dt className="font-semibold text-zinc-700 col-span-2">
      Hospitalization &amp; ED metrics are temporarily unavailable.
    </dt>
  </React.Fragment>
) : (
  (vm.hospMetrics as HospMetric[]).map((m) => (
    <React.Fragment key={m.label}>
      <dt className="font-semibold text-zinc-700">{m.label}</dt>
      <dd className="text-zinc-900">
        {m.value === null ? formatFootnote(m.footnoteCode) : (m.unit === 'percent' ? formatPercent(m.value) : formatRate(m.value))}
      </dd>
    </React.Fragment>
  ))
)}
```

**Key note:** Use `m.label` as the React key (unique per row). Wrap each `<dt>/<dd>` pair in `<React.Fragment key={m.label}>` to avoid the duplicate-key warning from split elements (RESEARCH.md Pitfall 6).

---

### `src/components/pdf/ReportPDF.tsx` (MODIFIED — append 12 flexbox rows)

**Analog:** itself — existing flexbox body rows (lines 162–260) are the exact pattern to continue.

**Existing row pattern** (ReportPDF.tsx lines 163–166):
```tsx
<View style={styles.row}>
  <Text style={styles.label}>Name of Facility</Text>
  <Text style={styles.value}>{vm.facility.displayName}</Text>
</View>
```

**Import change** — add `formatFootnote` and `formatPercent`/`formatRate` (already imported):
```tsx
import { formatRating, formatBeds, formatLocation, formatDate, formatFootnote, formatPercent, formatRate } from "@/lib/report/format";
import type { HospMetric } from "@/lib/cms/types";
```

**Append after row 13 inside `<Page>`** (after line 260 closing "Quality of Resident Care" `</View>`, before `<View style={styles.footer}>`):
```tsx
{/* Rows 14–25: 12 hospitalization/ED metric rows (Phase 5 / D-03/D-05) */}
{vm.hospMetrics === undefined ? (
  <View style={styles.row}>
    <Text style={[styles.value, { flex: 2 }]}>
      Hospitalization &amp; ED metrics are temporarily unavailable.
    </Text>
  </View>
) : (
  (vm.hospMetrics as HospMetric[]).map((m, i) => (
    <View key={i} style={styles.row}>
      <Text style={styles.label}>{m.label}</Text>
      <Text style={styles.value}>
        {m.value === null ? formatFootnote(m.footnoteCode) : (m.unit === 'percent' ? formatPercent(m.value) : formatRate(m.value))}
      </Text>
    </View>
  ))
)}
```

**Note:** react-pdf does not support `<React.Fragment key={...}>` — use array index `i` as `key` on `<View>`. `styles.row`, `styles.label`, `styles.value` are already defined in the existing StyleSheet (lines 91–106).

---

## Test Pattern Assignments

### `tests/lib/cms/claims-schema.test.ts` (NEW)

**Analog:** `tests/lib/cms/schema.test.ts` (full file read above)

**Imports pattern** (schema.test.ts lines 1–3):
```typescript
import { describe, expect, it } from "vitest";
import { CMSRowSchema } from "@/lib/cms/schema";
import providerFixture from "../../fixtures/provider-686123.json";
```
Mirror:
```typescript
import { describe, expect, it } from "vitest";
import { ClaimsRowSchema } from "@/lib/cms/claims-schema";
import claimsFixture from "../../fixtures/claims-686123.json";
```

**Test structure to replicate** (schema.test.ts lines 35–169):
- Happy path: `ClaimsRowSchema.safeParse(claimsFixture[0])` → success
- Typed output: `measure_code === "521"`, `typeof adjusted_score === "number"` for valid row
- Empty `adjusted_score` → `null` (D-08 — same as `suppressedRow` test at lines 55–64)
- `"0"` `adjusted_score` → `0` (real zero preserved — lines 67–88)
- Missing required key → `result.success === false` (lines 91–98)
- Non-numeric string in `adjusted_score` → fails (lines 120–128)
- `footnote_for_score` is preserved as string (new: not in provider schema)
- DATA-06 pattern: every schema key exists in `claimsFixture[0]` (lines 156–168)

### `tests/lib/cms/averages-schema.test.ts` (NEW)

**Analog:** `tests/lib/cms/schema.test.ts`

**Key tests to cover:**
- `AveragesRowSchema.safeParse(averagesFixture.NATION)` → success
- `state_or_nation === "NATION"` is preserved
- Extra hash-suffixed columns pass through (`.passthrough()` behavior — access `result.data['percentage_of_short_stay_residents_who_were_rehospitalized__1d02']`)
- Missing `state_or_nation` → fails

**Fixture import:**
```typescript
import averagesFixture from "../../fixtures/averages-xcdc.json";
// averagesFixture.NATION and averagesFixture.FL are the two rows
```

### `tests/lib/cms/claims-mapper.test.ts` (NEW)

**Analog:** `tests/lib/cms/mapper.test.ts` (full file read above)

**Imports pattern** (mapper.test.ts lines 1–4):
```typescript
import { describe, expect, it } from "vitest";
import { toFacilityData } from "@/lib/cms/mapper";
import { parseCMSRow } from "@/lib/cms/parse";
import providerFixture from "../../fixtures/provider-686123.json";
```
Mirror:
```typescript
import { describe, expect, it } from "vitest";
import { joinClaimsAndAverages } from "@/lib/cms/claims-mapper";
import { ClaimsRowSchema } from "@/lib/cms/claims-schema";
import { AveragesRowSchema } from "@/lib/cms/averages-schema";
import claimsFixture from "../../fixtures/claims-686123.json";
import averagesFixture from "../../fixtures/averages-xcdc.json";
```

**Test cases required (from RESEARCH.md Validation Architecture)**:
- CLM-01: `joinClaimsAndAverages(claimsFixture, NATION, FL)` returns exactly 12 items
- CLM-01: All 12 verbatim labels appear in order (match METRIC_DEFINITIONS)
- CLM-01: Measure 521 facility value = `25.575578` → `formatPercent(25.575578)` = "25.6%"
- CLM-02: Suppressed measure (synthetic: `adjusted_score: ""`, `footnote_for_score: "9"`) → `value === null`, `footnoteCode === "9"`
- CLM-02: Empty `adjusted_score` with no footnote → `value === null`, `footnoteCode === ""`
- CLM-03: Label order matches reference exactly
- Fewer-than-4 measures → returns `undefined` (triggers degraded line)

**Synthetic suppressed fixture pattern** (inline, like mapper.test.ts avoids real fixtures for edge cases):
```typescript
const suppressedClaimsRow: unknown = {
  cms_certification_number_ccn: "686123",
  measure_code: "521",
  measure_description: "...",
  resident_type: "Short Stay",
  adjusted_score: "",           // suppressed
  footnote_for_score: "9",      // footnote code 9 = "Not reported (small sample)"
  processing_date: "2026-05-01",
};
```

### `tests/lib/report/format.test.ts` (EXTEND — add formatFootnote tests)

**Analog:** itself — existing `describe("formatPercent")` and `describe("formatRate")` blocks (lines 59–98).

**New describe block to append** (same file, after line 154):
```typescript
describe("formatFootnote", () => {
  it("returns 'Not reported (small sample)' for footnote code 9", () => {
    expect(formatFootnote("9")).toBe("Not reported (small sample)");
  });
  it("returns 'Not available' for footnote code 7", () => {
    expect(formatFootnote("7")).toBe("Not available");
  });
  it("returns 'Not submitted' for footnote code 10", () => {
    expect(formatFootnote("10")).toBe("Not submitted");
  });
  it("returns 'Not enough data' for footnote code 1", () => {
    expect(formatFootnote("1")).toBe("Not enough data");
  });
  it("returns 'Not enough data' for footnote code 2", () => {
    expect(formatFootnote("2")).toBe("Not enough data");
  });
  it("returns 'Not enough data (annual measure)' for footnote code 28", () => {
    expect(formatFootnote("28")).toBe("Not enough data (annual measure)");
  });
  it("returns 'Not available' for an unknown code (safe generic fallback)", () => {
    expect(formatFootnote("99")).toBe("Not available");
  });
  it("returns 'Not available' for an empty string (no-footnote suppressed case)", () => {
    expect(formatFootnote("")).toBe("Not available");
  });
  it("returns 'Not available' for undefined", () => {
    expect(formatFootnote(undefined)).toBe("Not available");
  });
});
```

---

## Shared Patterns

### nullableNum (Empty-string → null coercion)
**Source:** `medelite-report/src/lib/cms/schema.ts` lines 23–39
**Apply to:** `claims-schema.ts` (for `adjusted_score`), and any numeric string field in `averages-schema.ts` if the mapper needs typed numbers.
**Critical:** `""` → `null`, `"0"` → `0`, non-numeric string → Zod validation failure (never silently coerced).

### SSRF + 8s Timeout Fetch Discipline
**Source:** `medelite-report/src/lib/cms/client.ts` lines 43–120
**Apply to:** `fetchClaimsMeasures` and `fetchAverages` in `client.ts`.
**Key rules:**
- Host+path from fixed constants only — user/CMS input is ONLY a `conditions[N][value]` parameter
- `AbortSignal.timeout(8000)` on every fetch
- `catch {}` around the `fetch()` call → `CmsError("network_error", ...)`
- `!resp.ok` → `CmsError("cms_api_error", ...)`
- `!Array.isArray(json.results)` envelope guard
- Row-level `Schema.safeParse(r)` per row — invalid rows dropped (graceful partial)

### CmsError throwing
**Source:** `medelite-report/src/lib/cms/errors.ts` lines 65–76
**Apply to:** `fetchClaimsMeasures` and `fetchAverages`.
**Import:** `import { CmsError } from "@/lib/cms/errors";`

### Promise.allSettled Fan-out (route handler)
**Source:** D-07 decision; standard Node.js/TypeScript
**Apply to:** `src/app/api/facility/route.ts`
**Pattern:** Run `fetchClaimsMeasures` + `fetchAverages` concurrently after `fetchFacility` resolves. Check `.status === 'fulfilled'` before accessing `.value`. If either is `'rejected'`, set `hospMetrics = undefined`.

### z.unknown().optional() → real schema replacement
**Source:** `medelite-report/src/lib/report/view-model.ts` line 125
**Apply to:** `view-model.ts` — replace stub with `z.array(HospMetricSchema).optional()`
**Critical:** Keep `.optional()` — the degraded state (D-09) sets `hospMetrics` absent in the model. Making it required breaks the degraded path.

### TypeScript isolatedModules export requirement
**Source:** All existing `.ts` files in `src/lib/cms/` and `tests/`
**Apply to:** ALL new `.ts` files — every file must have at least one `export` or `import` statement.

### Zod v4 safeParse result shape
**Source:** `tests/lib/cms/schema.test.ts` line 95 comment
**Apply to:** All new test files using `safeParse`.
```typescript
// Zod v4: use result.error.issues (NOT the v3 .errors property — undefined in v4)
if (!result.success) {
  expect(result.error.issues.length).toBeGreaterThan(0);
}
```

### `@/*` path alias
**Source:** All existing source files (`import { z } from "zod"`, `import { CmsError } from "@/lib/cms/errors"`)
**Apply to:** All new source files — use `@/lib/...` not relative `../../lib/...` for src imports. Test files use relative paths for fixtures: `"../../fixtures/claims-686123.json"`.

---

## No Analog Found

All Phase 5 files have strong analogs in the existing codebase. No files require fallback to RESEARCH.md examples as the primary pattern source.

---

## Metadata

**Analog search scope:** `medelite-report/src/lib/cms/`, `medelite-report/src/lib/report/`, `medelite-report/src/app/api/facility/`, `medelite-report/src/components/`, `medelite-report/tests/`
**Files scanned:** 15 source files + 10 test files + 4 fixture files
**Pattern extraction date:** 2026-06-18
