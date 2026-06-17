# Phase 2: API Routes, View Model & Config - Context

**Gathered:** 2026-06-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 2 delivers the **server API surface + the shared report data model** — no UI yet.

In scope:
- `GET /api/facility?ccn={ccn}` — validate CCN → fetch CMS (Provider Information `4pq5-n9py`) → Zod-validate → map to a typed `FacilityData` JSON body. Distinct error kinds for invalid format / not-found / upstream failure.
- `POST /api/export/pdf` **stub** — validates a `ReportViewModel` request body, returns 501 (not yet implemented). Phase 4 swaps the 501 for `renderToBuffer`.
- `assembleHeader(state)` — pure function, **state-only arg** (CLAUDE.md rule #2), returns the static branding block.
- `ReportViewModel` type + `assembleViewModel(facility, manual, generatedAt)` — the single source of truth all three render targets (preview/PDF/docx) consume.
- `next.config` — add `serverExternalPackages: ['@react-pdf/renderer']`; verify with `npm run verify:full` (incl. `next build`).

Out of scope (later phases):
- Web UI, CCN search box, live preview, error UI, Vercel deploy → Phase 3.
- Real PDF rendering → Phase 4. Claims metrics (`hospMetrics`) schemas + data → Phase 5 (`hospMetrics` stays optional/absent in the Phase-2 model). `.docx` → Phase 6. Charts/visual polish → Phase 7.

</domain>

<decisions>
## Implementation Decisions

### Error contract (API ↔ Phase-3 UI seam)
- **D-01: Full 5-kind error taxonomy.** Distinct machine `kind`s even when HTTP status overlaps:
  - `invalid_ccn` → **400** (failed the format gate, before any fetch)
  - `not_found` → **404** (valid format, zero CMS rows)
  - `network_error` → **502** (fetch failed/timed out — **transient**)
  - `cms_api_error` → **502** (CMS returned a non-200 — **transient**)
  - `validation_error` → **502** (CMS data failed Zod / a depended-on key vanished — **NON-transient**)
- **D-02: Structured payload with a server-supplied default message.** Body shape: `{ error: { kind, message, ...extra } }`. Server returns both a sensible default `message` AND a stable machine `kind`; the Phase-3 client may render the message directly or override per-kind. The `kind` stays stable even when copy changes.
- **D-03: Error body is a shared, Zod-validated discriminated union with an EXHAUSTIVE `kind`, exported for Phase 3 to import.** Adding a 6th kind later must produce a **compile error** in Phase 3's switch (exhaustiveness check), not a silent unhandled case. This is the safety net for committing to a fixed kind set now.
- **D-04: Message honesty by transience.** `network_error` / `cms_api_error` may use retry copy ("…please try again"). **`validation_error` must NOT** — a renamed CMS column won't heal on retry; it's really an alert to the operator. Use honest non-retry copy, e.g. *"We couldn't read this facility's data right now."* Sending the user into a retry loop that can't succeed is a defect.

### Diagnostics & info-leak discipline
- **D-05: `validation_error` leaks nothing to the client.** Client gets only `{ error: { kind: 'validation_error', message: <generic> } }`. The full `z.prettifyError(...)` ZodIssue output is `console.error`'d **server-side only** (visible in Vercel logs). No Zod field paths, expected-type strings, or schema internals in the HTTP response. An issue **count** in the body would be acceptable; full **paths** are not. `validation_error` is the one kind that carries **no extra detail field** (unlike `not_found`, which carries `ccn`).
- **D-06: Server log must be actionable.** On `validation_error`, log the **triggering CCN** alongside the prettified issues so the failure is reproducible. No PII concern — it's all public CMS data.
- **D-07: Only a normalized, length-capped `ccn` is ever echoed.** For `not_found`, the echoed `ccn` already passed the format gate (safe). For `invalid_ccn`, cap length and never reflect it anywhere it could render as markup (JSON body is low-risk; stay disciplined regardless).

### View model, formatters & dates
- **D-08: Typed model + one shared formatter family.** `ReportViewModel` carries raw `number | null` (never pre-stringified). A small **family** of formatters — `formatRating`, `formatBeds`, `formatPercent`, `formatRate` — differ in numeric formatting but all call **one shared null→placeholder rule and one shared `"N/A"` constant**. Consistency across preview/PDF/docx (RPT-02) comes from the shared helper, not from baking strings into the model; the raw number stays available for Phase-7 charts.
- **D-09: Suppressed/null placeholder = `"N/A"`** (core facility fields: star ratings, certified beds). Phase-5 **claims** metrics keep their own required text `"Not reported (small sample)"` (CLM-02) — different surface.
- **D-10: Formatter checks `=== null`, NEVER falsiness.** `if (!rating)` would turn a legitimate `0` into `"N/A"` — the Phase-1 empty→0 trap moved to the render layer. A rate of `0` is real data; only `null` is the gap. Write `if (value === null) return PLACEHOLDER`.
- **D-11: Charts bypass the text formatter.** Phase-7 chart paths read raw `number | null` straight from the model; a `null` becomes a chart gap / "Not rated" state, **never** the literal string `"N/A"`. Ensure the chart path does not accidentally route through `formatRating`.
- **D-12: Two dates, both honest.**
  - **"Generated on"** (report run date) — injected: `assembleViewModel(facility, manual, generatedAt)` takes the timestamp as a **parameter** (route/caller supplies it). The function stays **pure/deterministic**; tests pass a fixed date.
  - **"CMS data as of …"** — sourced from the validated payload's **`processing_date`** (e.g. fixture 686123 = `2026-05-01`). This is the *more important* freshness signal (CMS refreshes monthly/quarterly; figures can be weeks old). Fully deterministic — no clock, already in the data.
- **D-13: Pin the timezone when formatting date-only.** An injected instant still converts to "June 17," and that conversion is TZ-dependent — the PDF renders **server-side**, the preview **client-side**, so near midnight they could disagree (the exact cross-target divergence RPT-02 exists to prevent). `assembleViewModel` stores the **raw** injected value; the shared date formatter formats date-only in a **fixed/explicit TZ** (or inject an already-formatted string).

### FacilityData domain shape & mapper
- **D-14: Curated `FacilityData` domain model, passthrough dropped.** `GET /api/facility` returns a small camelCase domain object, NOT the raw `ParsedProvider` (which has snake_case + ~90 passthrough columns). CMS field names live **only** in `schema.ts` + `mapper.ts`; no consumer (client/PDF/docx) ever sees a CMS column name. A CMS rename then ripples in exactly one place.
- **D-15: `providerName ← provider_name` — NOT `legal_business_name`.** ⚠️ **Deliberate, fixture-verified reading — flag for planner/verifier (like Phase-1 D-06); do NOT "correct" it to `legal_business_name`.** Verified in `tests/fixtures/provider-686123.json`: `provider_name` = `"KENDALL LAKES HEALTHCARE AND REHAB CENTER"` (the operating name the reference report shows) vs `legal_business_name` = `"KENDALL LAKES HEALTHCARE AND REHAB CENTER, LLC"` (legal entity with the `LLC` suffix the reference omits). CLAUDE.md prose says "Name of Facility = CMS legal name," but the standing rule to **match the reference output** demands the operating name. Naming the field `providerName` keeps it source-faithful and prevents a mapper pulling the wrong column — the same class of mistake as the `provider_state`/`quality_measure_rating` sketch carried as a landmine (see D-22).
- **D-16: Reaffirmed mapper sources** (all pinned in `mapper.ts`):
  - `starRatings.overall ← overall_rating`, `healthInspection ← health_inspection_rating`, `staffing ← staffing_rating`, `qualityCare ← qm_rating` (**not** `longstay_qm_rating`/`shortstay_qm_rating`).
  - `certifiedBeds ← number_of_certified_beds`.
  - `ccn` and `state` kept as **strings** (leading zeros).
  - `processingDate ← processing_date` (the new freshness field, D-12).
- **D-17: Address = structured parts + shared `formatLocation`.** `FacilityData.address = { street, city, state }`; `formatLocation()` composes `"5280 SW 157 AVENUE, MIAMI, FL"` (no ZIP). The no-ZIP / comma-join rule lives in **one** place (the shared helper), never duplicated. Parts stay available if a later layout wants city on its own line.

### CMS fetch client
- **D-18: `client.ts` owns the whole pipeline.** `fetchFacility(ccn): Promise<FacilityData>` does: fetch + timeout → map HTTP status → `CmsError` (404→`not_found`, other non-200→`cms_api_error`) → `safeParseCMSRow` (fail→`validation_error`) → `toFacilityData()`. Returns `FacilityData` or throws a typed `CmsError`. The route handler is **thin**: call it, map `CmsError` → HTTP + payload. All CMS concerns in one unit, unit-tested by stubbing global `fetch`.
- **D-19: 8s timeout → `network_error`.** `fetch(url, { signal: AbortSignal.timeout(8000) })`; an abort/timeout is caught and surfaced as `network_error` (transient). Sits under Vercel Hobby's ~10s function wall so the user gets our clean error, not an opaque platform 504. Testable via a hanging-fetch mock.

### PDF export stub
- **D-20: Request body = the full `ReportViewModel`.** The client POSTs the exact assembled view model it previewed; Phase 4 renders straight from it — strongest PDF==preview guarantee (PDF-03), one source of truth (RPT-02), no second CMS round-trip. Trade-off (accepted): the server must Zod-validate the incoming vm before rendering (never trust client input) — which is why the request schema is defined now.
- **D-21: Stub validates now — 400 on bad shape, 501 on valid.** A new `ReportViewModelSchema` (Zod) parses the body: malformed → **400** `{ error: { kind: 'invalid_request', … } }`; well-formed → **501** `{ error: { kind: 'not_implemented', … } }` (same shared error envelope as D-02/D-03). The request contract is real and testable in Phase 2; Phase 4 just replaces the 501 with `renderToBuffer`. (Export-route `kind`s like `invalid_request`/`not_implemented` share the **envelope** shape with the facility route's `CmsError`; each route owns its own `kind` literal set.)

### Claude's Discretion
- **D-22: CCN validation rule (locked at discretion).** Gate on **6-char alphanumeric** (`/^[A-Za-z0-9]{6}$/`, uppercase-normalized + trimmed), **NOT** `^\d{6}$` — per CLAUDE.md's warning that alphanumeric CCNs / state codes exist. `ccn=12` → 400 `invalid_ccn`; any malformed input → 400 `invalid_ccn` before a fetch. Whitespace-trim and case-normalize before the gate. (User skipped this area; raise if the alphanumeric allowance is unwanted.)
- **D-23: No auto-retry in v1 (discretion).** `fetchFacility` fails fast → `network_error`; the user re-submits. Deterministic + easy to test; revisit only if flakiness shows up.
- **D-24: CMS base URL + dataset ID centralized (discretion).** `https://data.cms.gov/provider-data/api/1/datastore/query/{datasetId}/0` and the verified Provider-Information dataset id **`4pq5-n9py`** live in one `src/lib/cms/constants.ts`, traced to the fixture/metastore (rule #3), reused by the capture script's registry. Query uses the verified filter field **`cms_certification_number_ccn`** (see canonical refs — NOT `federal_provider_number`).
- **D-25: `next.config` serverExternalPackages (discretion).** Add `serverExternalPackages: ['@react-pdf/renderer']` even though react-pdf is on Next.js 16's auto-opt-out list — defensive vs Turbopack bug #88844 (PITFALLS.md). Confirm immediately with `npm run verify:full`. Node.js runtime (not Edge) for any route that may touch react-pdf later.
- Exact module layout under `src/lib/` (`cms/client.ts`, `cms/mapper.ts`, `cms/types.ts`, `cms/errors.ts`, `cms/constants.ts`, `report/header.ts`, `report/view-model.ts`, `report/format.ts`), file naming, and Zod construction details — provided they honor D-01–D-25 and the Phase-1 schema contract.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Authoritative spec & rules
- `CLAUDE.md` (repo root) — standing rules (#1–#7), field-mapping table (location no-ZIP, `qm_rating`=Quality, name overridable), verified dataset IDs, `assembleHeader()` no-facility-name rule (#2), test CCN 686123.
- `CHECKLIST.md` (repo root) — per-phase acceptance criteria.
- `medelite-report/AGENTS.md` — **Next.js 16 caveat**: read the relevant guide in `medelite-report/node_modules/next/dist/docs/` (esp. `01-app/03-api-reference/03-file-conventions/route.md` for Route Handlers; `…/05-config/01-next-config-js/serverExternalPackages.md`) before writing/changing any Next.js code. **`route handler params is a Promise — await ctx.params`.**

### Planning artifacts
- `.planning/ROADMAP.md` §"Phase 2: API Routes, View Model & Config" — goal + 5 success criteria + the location/`qm_rating` notes.
- `.planning/REQUIREMENTS.md` — DATA-01/03/04/05, NAME-01/02, RPT-01/02 (this phase); ERR-01 (Phase 3) drives the 5-kind taxonomy; PDF-03 drives the full-vm POST body.
- `.planning/phases/01-foundation-cms-data-layer/01-CONTEXT.md` — Phase-1 schema design (D-04..D-12): `.passthrough()`, required-key + `.nullable()`, empty→null-before-coerce, `"0"` preserved, CCN/ZIP as strings.

### Research (read for field names & pitfalls — with one CAUTION)
- `.planning/research/STACK.md` — verified library versions; CMS API specifics; **`cms_certification_number_ccn`** as the CCN filter field; empty-string suppression handling.
- `.planning/research/PITFALLS.md` — `serverExternalPackages` Turbopack bug #88844 (D-25); font CDN URLs (Phase 4); recharts v2 pin (Phase 7).
- `.planning/research/ARCHITECTURE.md` — route-handler vs server-action rationale, `CmsError` union sketch, `assembleHeader`/`ReportViewModel`/`assembleViewModel` sketches, error-flow table. ⚠️ **CAUTION — do NOT copy its `mapper.ts` field names from memory:** it sketches `federal_provider_number`, `provider_state`, `provider_city`, `provider_zip_code`, `quality_measure_rating`, and `legalName` — all WRONG. The verified fixture fields are `cms_certification_number_ccn`, `state`, `citytown`, `zip_code`, `qm_rating`, and `provider_name` (see D-15/D-16). Use ARCHITECTURE.md for *structure*, the Phase-1 schema + fixture for *field names*.

### Source files (the Phase-2 contract foundation)
- `medelite-report/src/lib/cms/schema.ts` — `CMSRowSchema` (`ParsedProvider`); the `nullableNum` coercion; the depended-on keys the mapper reads.
- `medelite-report/src/lib/cms/parse.ts` — `parseCMSRow` / `safeParseCMSRow`; Zod v4 note (`result.error.issues`, `z.prettifyError`).
- `medelite-report/tests/fixtures/provider-686123.json` — the verified field-name + value anchor (used in D-15 verification).

### External (not a repo file)
- **CMS NH Data Dictionary** — authoritative field-traceability source (rule #3); consult alongside the captured fixture.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/cms/schema.ts` (`CMSRowSchema` / `ParsedProvider`) + `src/lib/cms/parse.ts` (`safeParseCMSRow`) — the mapper consumes `safeParseCMSRow`'s typed output; a `validation_error` is precisely a `safeParse` failure (D-18).
- `medelite-report/scripts/capture-fixture.ts` — already holds a dataset registry with the base URL + dataset IDs (D-03 Phase 1). `cms/constants.ts` should share/source from the same verified ids (D-24), not re-hardcode independently.
- `medelite-report/scripts/verify.mjs` — the gate. Phase-2 closes on `npm run verify:full` (gate + `next build`).

### Established Patterns
- `vitest.config.ts` — node env; test globs `tests/**/*.test.ts` + `src/**/*.test.ts`; `resolve.alias` `@/* → ./src` already added in Phase 1 (route/handler + view-model tests rely on it).
- `tsconfig.json` — `strict`, `isolatedModules` (every `.ts` needs import/export), `resolveJsonModule` (tests import fixtures directly), `@/*` path alias.
- Zod v4 idioms: `result.error.issues` (not `.errors`), `z.prettifyError(result.error)` — already used in `parse.ts`.

### Integration Points
- `GET /api/facility` consumes `fetchFacility` (D-18); its `FacilityData` output (D-14) is the input to `assembleViewModel` and, transitively, to Phase 3's preview, Phase 4's PDF, Phase 6's docx.
- `ReportViewModelSchema` (D-21) is the contract shared by the PDF stub now and the real PDF/docx export routes later — define it as the single canonical view-model schema.
- `assembleHeader(state)` (state-only — rule #2) is called by all three render layers off `vm`/`FacilityData.state`; single header source of truth.

</code_context>

<specifics>
## Specific Ideas

- Reference facility CCN **686123** (Kendall Lakes Healthcare and Rehab Center, FL). Live fixture values used to pin decisions this session: `provider_name="KENDALL LAKES HEALTHCARE AND REHAB CENTER"`, `legal_business_name="…, LLC"`, `qm_rating="5"`, `processing_date="2026-05-01"`, `number_of_certified_beds="150"`, address `5280 SW 157 AVENUE / MIAMI / FL` (zip `33185`, dropped).
- The `processing_date` = `2026-05-01` vs a June-17 "Generated on" date is the concrete illustration of why **two dates** matter (D-12): ~6 weeks of CMS-data drift a single "generated" date would hide.
- The `provider_name` vs `legal_business_name` distinction (D-15) is the session's most important catch — the operating name (no `LLC`) is what the reference report shows.
- Required test (from D-05): assert the malformed-fixture `validation_error` response body contains **zero** Zod internals — only `kind: 'validation_error'` + the generic message, nothing resembling a field path or expected-type string. Turns leak-prevention into an enforced invariant.

</specifics>

<deferred>
## Deferred Ideas

- Real PDF rendering (`renderToBuffer`, `<ReportPDF/>`, Medicare `<Link>`) → Phase 4 (the stub's 501 becomes the renderer).
- Web UI / CCN search / live preview / error UI / Vercel deploy → Phase 3 (consumes this phase's API + view model + error union).
- Claims `hospMetrics` schemas + the 12 data points → Phase 5 (`hospMetrics?` stays optional in `FacilityData`/`ReportViewModel`).
- `.docx` export → Phase 6; star-rating cards + charts (raw `number|null` per D-11) + 300ms debounce → Phase 7.
- v2 benchmarks (BENCH-01/02) — already deferred at init.

None of the above is scope creep into Phase 2 — they are the downstream consumers this phase's contracts are shaped to serve.

</deferred>

---

*Phase: 2-API Routes, View Model & Config*
*Context gathered: 2026-06-17*
