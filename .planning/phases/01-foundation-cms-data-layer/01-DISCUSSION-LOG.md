# Phase 1: Foundation & CMS Data Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-16
**Phase:** 1-Foundation & CMS Data Layer
**Areas discussed:** Fixture capture scope, Zod schema breadth, Typing & suppressed values, Fixture as test anchor

Pre-flight scope decision (from `/gsd-plan-phase 1`): Phase 1 is **foundation-only**; the MVP Walking-Skeleton gate is intentionally NOT applied (UI slice + deploy stay in Phase 3, per ROADMAP). Recorded in project memory.

---

## Fixture capture scope

| Option | Description | Selected |
|--------|-------------|----------|
| A. Provider-only + extensible script | Capture `4pq5-n9py` → `provider-686123.json` per roadmap; build capture script around a dataset registry so Phase 5 adds entries | |
| B. Capture all 3 now | Also capture `ijh5-nb2v` (claims) + `xcdc-v8bm` (state/national avgs) to anchor every field name early and de-risk Phase 5 | ✓ |

**User's choice:** Option B.
**Notes:** Claude clarification recorded in CONTEXT.md: capture all 3 fixtures now, but build only the **provider** schema in Phase 1; claims/averages schemas remain Phase 5 work (foundation-only). Capture script structured as a dataset registry; re-resolve dataset IDs via the metastore at capture time.

---

## Zod schema breadth

| Option | Description | Selected |
|--------|-------------|----------|
| Lean + passthrough | Model only report-used fields; `.passthrough()` the ~90 other columns | ✓ |
| Full-row exhaustive | Model every CMS column | |

**User's choice:** Lean + passthrough, with a key refinement.
**Notes:** User's nuance — passthrough is resilient to *added* columns but blind to renamed/removed ones. So keep depended-on **keys required** with **`.nullable()` values** (not blanket `.optional()`): a suppressed value (empty string, key present) → null and doesn't throw, but a renamed/removed key fails `safeParse` loudly. This is the runtime enforcement of the traceability invariant (rule #3). Intentionally refines ROADMAP SC#4's literal `.nullable().optional()` — flagged in CONTEXT.md so the verifier doesn't treat the missing `.optional()` as a defect.

---

## Typing & suppressed values

| Option | Description | Selected |
|--------|-------------|----------|
| Coerce in schema | numeric strings → number, `""` → null, inside the schema (one source of truth) | ✓ |
| Keep raw strings | Coerce later in the view-model layer | |

**User's choice:** Coerce in schema, with three rules.
**Notes:** (1) Map `""`/whitespace-only → null **before** numeric coercion — `z.coerce.number("")` is `0`, not null, so skipping this renders every suppressed value as 0 (e.g. "0%" hospitalization, 0-star rating). (2) Only empty/whitespace → null; preserve a real `"0"` as `0`. (3) Don't coerce identifier/text-numeric fields — CCN and ZIP stay strings to preserve leading zeros (CCN is Text(6); dictionary warns about leading-zero loss). Coerce only certified beds, the four ratings, and (Phase 5) the claims rates.

---

## Fixture as test anchor

| Option | Description | Selected |
|--------|-------------|----------|
| Committed fixture = source of truth | Tests run offline against committed fixture; live calls confined to `fixture:capture` + one env-gated/`describe.skip` smoke test | ✓ |
| Tests hit live API | Unit tests call CMS directly | |

**User's choice:** Committed fixture as single source of truth — locked.
**Notes:** User addition — also commit a few small **malformed** fixtures (missing required key, suppressed-to-null, wrong-shape/invalid-CCN response) so the error-path tests have something to assert against. "All error paths handled and tested" is non-negotiable (rule #6 / ERR-02); the happy-path capture won't exercise those branches.

## Claude's Discretion

- Exact `src/lib/` module layout and file naming.
- Exact Zod construction (`z.preprocess` vs `.transform`) for the empty→null pre-step, provided D-05–D-10 hold and a test proves missing-key fails loudly.
- Whether the capture script needs deps beyond the installed `tsx`.

## Deferred Ideas

- Claims & state/national-average Zod schemas → Phase 5 (fixtures pre-captured in Phase 1).
- API routes, `ReportViewModel`, `assembleHeader()` → Phase 2.
- UI, CCN search, live preview, error UI, Vercel deploy → Phases 2–3.
- v2 benchmarks (BENCH-01, BENCH-02) — deferred at init.
