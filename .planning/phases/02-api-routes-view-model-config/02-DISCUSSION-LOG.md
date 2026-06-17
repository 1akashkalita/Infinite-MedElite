# Phase 2: API Routes, View Model & Config - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-17
**Phase:** 2-API Routes, View Model & Config
**Areas discussed:** Error contract, View-model edges, FacilityData domain shape, CMS Fetch, PDF stub request shape

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| CCN validation rule | 6-char alphanumeric vs strict 6-digit (the 400 boundary) | (deferred to discretion) |
| Error contract | Granularity + payload shape | ✓ |
| PDF export stub | What POST /api/export/pdf returns now | (revisited later as "PDF stub request shape") |
| View-model edges | Null handling + generation timestamp | ✓ |

**User's choice:** Error contract, View-model edges. Later expanded to also explore FacilityData domain shape, CMS Fetch, and PDF stub request shape.

---

## Error contract

### Taxonomy granularity
| Option | Description | Selected |
|--------|-------------|----------|
| Full 5-kind taxonomy | invalid_ccn(400), not_found(404), network_error(502), cms_api_error(502), validation_error(502) | ✓ |
| Minimal 3-kind | invalid_ccn, not_found, single upstream_error bucket | |
| 4-kind (collapse CMS errors) | merge cms_api_error + validation_error | |

### Payload shape
| Option | Description | Selected |
|--------|-------------|----------|
| Structured + server message | `{ error: { kind, message, ...extra } }`, server supplies default message + stable kind | ✓ |
| Code only — client owns copy | `{ error: 'not_found' }` bare code | |
| Flat code + message | `{ error: 'not_found', message: '...' }` | |

### Diagnostics on validation_error
| Option | Description | Selected |
|--------|-------------|----------|
| Generic client, log internally | Generic message to client; full Zod issues console.error'd server-side | ✓ |
| Include issue summary in response | Add detail field (count or prettified message) to body | |
| Generic only, no server log | Generic message, nothing logged | |

**Notes (user refinements, all accepted):**
- Error body = a **shared Zod-validated discriminated union with exhaustive `kind`, exported for Phase 3** so a future 6th kind is a compile error in the client switch.
- Drop "try again later" for `validation_error` specifically (non-transient) — honest non-retry copy ("We couldn't read this facility's data right now"); reserve retry language for `network_error`/`cms_api_error`.
- Server log must include the **triggering CCN** + prettified issues (reproducible; no PII — public CMS data).
- Add a test asserting the malformed-fixture response body contains **no Zod internals** (only kind + generic message).
- Only echo a **normalized, length-capped `ccn`**; rich detail (Zod paths, vanished key) to logs only — issue count OK in body, full paths not. `validation_error` carries no extra detail field; `not_found` carries `ccn`.

---

## View-model edges

### Null representation
| Option | Description | Selected |
|--------|-------------|----------|
| Typed null + shared formatter | Model carries number\|null; one shared formatter maps null→placeholder | ✓ |
| Pre-formatted display strings | Model carries '5'/'N/A' strings | |
| Raw null, each layer formats | Each render layer handles null inline | |

### Placeholder text
| Option | Description | Selected |
|--------|-------------|----------|
| "N/A" | Compact, matches Phase-7 checklist wording | ✓ |
| "Not Rated" | Descriptive for star ratings, long for beds | |
| "—" (em dash) | Clean but ambiguous (reads as layout gap) | |

### Generation date / determinism
| Option | Description | Selected |
|--------|-------------|----------|
| Date shown, injected | assembleViewModel(…, generatedAt) param; stays pure; date-only | ✓ |
| Date shown, new Date() inside | Simple but non-deterministic, flaky snapshots | |
| No date in v1 | Omit entirely | |

**Notes (user refinements, all accepted):**
- **Two dates**, not one: keep injected "Generated on" AND add **"CMS data as of …" from the payload `processing_date`** — the deterministic freshness signal (fixture = 2026-05-01) that prevents a "data is current" misread.
- **Pin the timezone** in the shared date formatter (PDF server-side vs preview client-side can disagree near midnight); `assembleViewModel` stores the raw value, formatter formats date-only in a fixed TZ (or inject a pre-formatted string).
- Formatter must check `=== null`, **not** falsiness (a real `0` is data — the Phase-1 empty→0 trap moved to render).
- A **family** of formatters (`formatRating`/`formatBeds`/`formatPercent`/`formatRate`) sharing one null→placeholder rule + one `"N/A"` constant.
- Charts read raw `number|null` from the model, **never** through the text formatter.

---

## FacilityData domain shape

### Body shape
| Option | Description | Selected |
|--------|-------------|----------|
| Curated FacilityData | Small camelCase domain model; passthrough dropped; CMS names only in schema/mapper | ✓ |
| Return ParsedProvider raw | snake_case + ~90 passthrough columns leaked | |
| Curated + raw escape hatch | Curated + full raw under _raw | |

### Address representation
| Option | Description | Selected |
|--------|-------------|----------|
| Structured parts + shared formatter | address{street,city,state} + formatLocation() | ✓ |
| Pre-composed location string | Mapper writes the composed string once | |

**Notes (user correction — verified against fixture):**
- **`providerName ← provider_name`, NOT `legal_business_name`.** Verified: `provider_name="KENDALL LAKES HEALTHCARE AND REHAB CENTER"` (operating name the reference shows) vs `legal_business_name="…, LLC"`. Source-faithful field name; flagged for planner/verifier so it isn't "corrected" back. Same class of mistake as the ARCHITECTURE.md `provider_state`/`quality_measure_rating` sketch landmine.
- Reaffirm in mapper.ts: `qualityCare←qm_rating` (not long/short-stay), address no-ZIP rule in one place, `ccn`/`state` as strings, `processingDate` carried through.

---

## CMS Fetch — timeout and where it lives

### Timeout
| Option | Description | Selected |
|--------|-------------|----------|
| 8s AbortSignal → network_error | Under Vercel ~10s wall; clean error not platform 504 | ✓ |
| 5s aggressive | Risks aborting healthy-but-slow CMS | |
| No explicit timeout | Rides to opaque platform 504; untestable | |

### Pipeline boundary
| Option | Description | Selected |
|--------|-------------|----------|
| client.ts owns the whole pipeline | fetchFacility(ccn): fetch+timeout→status→CmsError→safeParse→toFacilityData | ✓ |
| client = raw fetch only; route orchestrates | Scatters CMS logic into the route | |
| Three-way split (fetch/map/route) | More ceremony than one linear lookup needs | |

**Notes:** Discretion calls recorded — no auto-retry in v1 (fail fast → network_error); base URL + dataset id `4pq5-n9py` centralized in `cms/constants.ts`, reused from the capture registry.

---

## PDF stub request shape

### Request body
| Option | Description | Selected |
|--------|-------------|----------|
| Full ReportViewModel | Strongest PDF==preview (PDF-03); no re-fetch; server must Zod-validate | ✓ |
| { ccn, manualInputs } | Server re-fetches+re-assembles; double CMS call; can diverge | |
| { facilityData, manualInputs } | Server re-assembles; subtle preview/export seam | |

### Stub depth
| Option | Description | Selected |
|--------|-------------|----------|
| Validate now: 400 bad / 501 valid | New ReportViewModelSchema; malformed→400 invalid_request, valid→501 not_implemented | ✓ |
| Bare 501, no body parsing | Validates nothing; contract unproven until Phase 4 | |

**Notes:** Export-route `kind`s (`invalid_request`/`not_implemented`) share the error **envelope** with the facility route's `CmsError`; each route owns its own `kind` set.

---

## Claude's Discretion

- **CCN validation:** 6-char alphanumeric (`/^[A-Za-z0-9]{6}$/`, trimmed + uppercased), not `^\d{6}$` (alphanumeric CCNs exist). `ccn=12`→400. (User skipped this area.)
- **Retry:** none in v1 — fail fast to `network_error`.
- **CMS base URL + `4pq5-n9py` dataset id:** centralized in `cms/constants.ts`, traced to fixture/metastore, query filter field `cms_certification_number_ccn`.
- **next.config:** add `serverExternalPackages: ['@react-pdf/renderer']` defensively (Turbopack #88844); confirm with `verify:full`; Node runtime for react-pdf-touching routes.
- Exact `src/lib/` module layout, file naming, and Zod construction details.

## Deferred Ideas

- Real PDF rendering → Phase 4. Web UI / search / preview / error UI / deploy → Phase 3. Claims `hospMetrics` → Phase 5. `.docx` → Phase 6. Star cards + charts + 300ms debounce → Phase 7. v2 benchmarks (BENCH-01/02) deferred at init. None are Phase-2 scope creep — they are the downstream consumers this phase's contracts serve.
