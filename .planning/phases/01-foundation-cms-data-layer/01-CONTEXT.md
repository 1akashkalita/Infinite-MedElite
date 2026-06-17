# Phase 1: Foundation & CMS Data Layer - Context

**Gathered:** 2026-06-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 1 delivers the **verified, type-safe CMS data layer** — nothing user-facing.

In scope:
- Implement `npm run fixture:capture` (currently a no-op placeholder) and capture the CMS fixtures.
- Install the 5 production libraries (`@react-pdf/renderer`, `zod`, `docx`, `recharts`@v2, `react-pdf-charts`).
- Build the **provider** Zod schema (`CMSRowSchema`) + a typed parsing pipeline.
- Keep `npm run verify` (typecheck → lint → format → test) green.

Out of scope (later phases — **foundation-only**, no Walking Skeleton despite MVP mode):
- API route handlers, view-model, `assembleHeader()` → Phase 2.
- UI, CCN search, live preview, error UI, Vercel deploy → Phase 3.
- PDF export → Phase 4. Claims **schemas** → Phase 5 (fixtures are pre-captured here, see D-02). .docx → Phase 6. Charts/polish → Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Fixture capture scope (Option B — capture all 3 datasets now)
- **D-01:** Capture **all three** CMS datasets for the reference facility now, not just provider info:
  - Provider Information `4pq5-n9py` → `tests/fixtures/provider-686123.json` (required by ROADMAP SC#1).
  - Medicare Claims Quality Measures `ijh5-nb2v` → the 4 facility hospitalization/ED measures for CCN 686123.
  - State US Averages `xcdc-v8bm` → rows keyed `state_or_nation` = `NATION` and `FL`.
  Rationale: the capture script is being built now anyway; capturing all three **anchors every CMS field name early** so Phase 5 never invents a field name from memory (DATA-06 / rule #3 covers Phase 5 fields too) and de-risks Phase 5.
- **D-02:** Phase 1 builds **only the provider `CMSRowSchema`** + typed pipeline. The claims/averages fixtures are captured and committed but their Zod schemas are deferred to Phase 5 (keeps Phase 1 foundation-only; claims domain understanding belongs in Phase 5). The pre-captured fixtures are the anchor Phase 5 builds against.
- **D-03:** Structure the capture script around a small **dataset registry** (id → output path) so Phase 5 adds entries, not new plumbing. **Re-resolve dataset IDs via the CMS metastore at capture time** (rule #3 — distribution IDs rotate; query the stable dataset-ID endpoint).

### Zod schema shape & strictness
- **D-04:** **Lean schema** — model only the fields the report actually depends on; `.passthrough()` all other columns (CMS provider rows have ~100 columns; passthrough keeps us resilient to CMS *adding* columns).
- **D-05:** Depended-on fields are **required keys with `.nullable()` values — NOT `.optional()`**. A present-but-suppressed value (CMS returns `""`, key present) coerces to `null` and does not throw; a **renamed/removed key** makes `safeParse` fail **loudly**. This is the runtime enforcement of the traceability invariant (rule #3 / DATA-06): `.optional()` would silently mask a rename and yield `undefined`, defeating the invariant.
- **D-06 (deliberate deviation — flag for planner/verifier):** This **refines** ROADMAP SC#4's literal `.nullable().optional()` to **required-key + `.nullable()`-value** for depended-on fields. Same *intent* ("a suppressed-data facility does not throw"), but `.optional()` is intentionally dropped. Valid because CMS suppression = empty *string* with the key present, never a missing key. **Do not treat the absent `.optional()` as a defect.**

### Typing & suppressed-value coercion (coerce inside the schema)
- **D-07:** Coerce inside the schema so downstream consumers (view-model, PDF, .docx in later phases) get clean typed values from **one source of truth** — numeric strings → `number`.
- **D-08:** Map `""` / whitespace-only → `null` **before** numeric coercion. `z.coerce.number("")` yields `0`, not `null` — skip this pre-step and every suppressed value renders as `0` (e.g. "0%" hospitalization, a 0-star rating). Implementation: preprocess empty/whitespace → null, *then* coerce.
- **D-09:** Only empty/whitespace → null; **preserve a real `"0"` as `0`** so a legitimate zero rate is not nulled out.
- **D-10:** **Do NOT coerce identifier / text-numeric fields** — CCN and ZIP stay **strings** to preserve leading zeros (CCN is `Text(6)`; the NH Data Dictionary itself warns about leading-zero loss). Coerce only the genuine numerics: certified beds, the four star ratings, and (Phase 5) the claims rates.

### Fixture as test anchor
- **D-11:** The committed fixture(s) are the **single source of truth** for all unit tests — deterministic, offline, CI-safe. Live CMS calls are confined to `npm run fixture:capture` plus **one** env-gated / `describe.skip` live smoke test.
- **D-12:** Also commit small **malformed** fixtures so error-path tests have something to assert against: (a) a row missing a required key, (b) a suppressed-to-null row (empty-string values), (c) a wrong-shape / invalid-CCN response. "All error paths handled and tested" is non-negotiable (CLAUDE.md rule #6, ERR-02); the happy-path capture won't exercise those branches.

### Required test assertions (derived — planner must encode these)
- Suppressed empty-string value → `null` (**not** `0`).
- A real `"0"` → `0`.
- A row missing a required (depended-on) key → `safeParse` **fails**.
- CCN and ZIP preserve leading zeros as **strings**.
- The captured reference fixture row → `safeParse` succeeds with correctly typed output.

### Claude's Discretion
- Exact module layout under `src/lib/` (e.g. `cms/schema.ts`, `cms/types.ts`, `cms/parse.ts`) and file naming.
- Exact Zod construction (`z.preprocess` vs `.transform`, how the empty→null pre-step is composed) — provided it honors D-05 through D-10 and the empty-key-fails-loudly behavior is proven by a test.
- Whether the capture script needs deps beyond the already-installed `tsx`.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec & rules
- `CLAUDE.md` (repo root) — standing rules (#1–#7), field mapping table, verified dataset IDs (`4pq5-n9py`, `ijh5-nb2v`, `xcdc-v8bm`), claims-metrics specifics, test case CCN 686123.
- `CHECKLIST.md` (repo root) — per-phase acceptance criteria.
- `medelite-report/AGENTS.md` — **Next.js 16 caveat**: read the relevant guide in `medelite-report/node_modules/next/dist/docs/` before writing/changing any Next.js code.

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 1: Foundation & CMS Data Layer" — goal + 5 success criteria.
- `.planning/REQUIREMENTS.md` — DATA-02 (Zod validation + graceful suppressed handling) and DATA-06 (field traceability); plus downstream DATA-01/03/04/05 the schema must serve.
- `.planning/STATE.md` — Accumulated Context: CCN field name verified as `cms_certification_number_ccn`; empty-string suppression; recharts v2; font CDN pitfalls.

### Research (read for field names & pitfalls)
- `.planning/research/STACK.md` — verified library versions, CMS Provider Data Catalog API specifics, **`cms_certification_number_ccn`** as the CCN filter field, empty-string suppression handling.
- `.planning/research/PITFALLS.md` — suppressed values as empty strings (the empty→0 trap), recharts v2 pin, `serverExternalPackages` (Phase 2), font CDN URLs.
- `.planning/research/ARCHITECTURE.md` — data-layer architecture. ⚠️ **Caution:** this doc sketched `federal_provider_number` *from memory* — DO NOT copy it; the verified CCN field is `cms_certification_number_ccn` (STACK.md / STATE.md).
- `.planning/research/FEATURES.md`, `.planning/research/SUMMARY.md` — feature/research synthesis.

### External (not a repo file)
- **CMS NH Data Dictionary** — the authoritative source for field traceability (rule #3). Referenced conceptually in CLAUDE.md; consult alongside the captured fixture. The captured fixture is the in-repo anchor.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `medelite-report/scripts/capture-fixture.ts` — currently a typed no-op (`captureFixtures()` logs "No fixtures configured yet."). This is the entrypoint to implement; wired to `npm run fixture:capture` via `tsx`.
- `medelite-report/scripts/verify.mjs` — the quality gate; runs typecheck → lint → format:check → test, records all results (no short-circuit), exits non-zero on any failure. Phase 1 must keep this green.

### Established Patterns
- `medelite-report/vitest.config.ts` — node environment; test glob `tests/**/*.test.ts` and `src/**/*.test.ts`. New tests follow either location.
- `medelite-report/tests/smoke.test.ts` — existing test pattern to mirror.
- `medelite-report/tsconfig.json` — `strict`, `isolatedModules` (every `.ts` needs an import/export), **`resolveJsonModule: true`** (tests can import the fixture JSON directly), path alias `@/*` → `./src/*`.

### Integration Points
- New schema/types/parse modules under `medelite-report/src/lib/` are consumed in Phase 2 by the `/api/facility` route handler and the shared `ReportViewModel`. Design the typed output (post-coercion) as that contract's foundation.

</code_context>

<specifics>
## Specific Ideas

- Reference facility: **CCN 686123** (Kendall Lakes Healthcare and Rehab Center, FL) → `https://www.medicare.gov/care-compare/details/nursing-home/686123`.
- The specific landmine the user called out: the **empty-string → `0` coercion trap** (`z.coerce.number("")` === `0`). The schema must map empty/whitespace → null *before* coercion, or suppressed metrics silently render as zeros.
- The traceability invariant must be enforced at **runtime** (loud `safeParse` failure on a missing depended-on key), not just at authoring time.

</specifics>

<deferred>
## Deferred Ideas

- **Claims & state/national-average Zod schemas** → Phase 5. The fixtures (`ijh5-nb2v`, `xcdc-v8bm`) are captured and committed in Phase 1 to anchor field names, but schematizing them is Phase 5 work.
- **API routes, `ReportViewModel`, `assembleHeader()`** → Phase 2.
- **UI, CCN search, live preview, error UI, Vercel deploy** → Phases 2–3.
- **v2 benchmarks** (BENCH-01 comparison charts, BENCH-02 better/worse flags) — already deferred at init.

</deferred>

---

*Phase: 1-Foundation & CMS Data Layer*
*Context gathered: 2026-06-16*
