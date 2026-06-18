---
phase: 3
slug: web-ui-core-flow-deployment
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x (node env) |
| **Config file** | `medelite-report/vitest.config.ts` |
| **Quick run command** | `npx vitest run tests/` |
| **Full suite command** | `npm run verify` (typecheck → lint → format:check → test) |
| **Estimated runtime** | ~20 seconds (quick); ~40s (verify) |

> **Vitest is node-env only — no DOM.** Do NOT render React components in tests.
> Extract pure logic (CCN pre-check regex, error-kind → message/placement mapping,
> formatters) into `src/lib/` modules and test those directly. Pattern proven by
> `tests/api/facility.test.ts` and `tests/lib/report/view-model.test.ts`.

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/`
- **After every plan wave:** Run `npm run verify`
- **Before `/gsd:verify-work`:** `npm run verify:full` (verify + `next build`) green
- **Phase gate (DEP-01):** `npm run verify:full` green **and** the live Vercel URL returns 200
- **Max feedback latency:** ~20 seconds

---

## Per-Task Verification Map

> Task IDs are filled in by the planner. The rows below bind each phase requirement
> to its validation point per `03-RESEARCH.md` § Phase Requirements → Test Map.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| LOOK-01 | Submit CCN 686123 → preview populates from `GET /api/facility` | integration (route) | `npx vitest run tests/api/facility.test.ts` | ✅ existing | ⬜ pending |
| LOOK-02 | Client CCN pre-check: empty / too-short / special chars / valid 6-char | unit | `npx vitest run tests/lib/ccn-precheck.test.ts` | ❌ Wave 0 | ⬜ pending |
| LOOK-03 | `invalid_ccn` vs `not_found` produce distinct messages | unit | `npx vitest run tests/lib/error-kind-mapping.test.ts` | ❌ Wave 0 | ⬜ pending |
| ERR-01 | All 5 error kinds → message + placement (inline/banner), exhaustive | unit | `npx vitest run tests/lib/error-kind-mapping.test.ts` | ❌ Wave 0 | ⬜ pending |
| ERR-01 | Suppressed fields render N/A (not an error) — `=== null` formatters | unit | `npx vitest run tests/lib/report/format.test.ts` | ✅ existing | ⬜ pending |
| ERR-02 | `assertNever` exhaustiveness: switch covers all 5 kinds | compile-time | `tsc --noEmit` (in `npm run verify`) | implicit | ⬜ pending |
| INPT-01/02/03 | `assembleViewModel` with all six manual inputs → vm fields set | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ✅ existing (extend for `previousProviderPerformance`) | ⬜ pending |
| PREV-01 | Manual input change reflected in assembled preview vm | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ✅ existing | ⬜ pending |
| NAME-02 | `assembleHeader` output never contains facility name (body-only override) | unit | `npx vitest run tests/lib/report/header.test.ts` | ✅ existing | ⬜ pending |
| DEP-01 | App builds and live Vercel URL returns 200 | smoke | manual: `curl -sI <vercel-url>` | ❌ manual-only | ⬜ pending |
| DEP-02 | Code in public GitHub repo (commits pushed) | manual | `gh repo view --json visibility` | ❌ manual-only | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] **Extend `ManualInputs` + `ReportViewModelSchema`** with `previousProviderPerformance?: string` — Phase 2 omitted this sixth field (INPT-01). Update `tests/lib/report/view-model.test.ts` to assert it round-trips. *(Type extension; no existing test breaks.)*
- [ ] `tests/lib/ccn-precheck.test.ts` — stubs for LOOK-02 (client format pre-check `/^[A-Za-z0-9]{6}$/`, trim + uppercase, mirrors server gate)
- [ ] `tests/lib/error-kind-mapping.test.ts` — stubs for ERR-01/LOOK-03 (all 5 kinds → message copy + inline/banner placement; exhaustive via `assertNever`)
- [ ] `tests/lib/report/format.test.ts` — confirm/extend N/A render path coverage (null formatters return `'N/A'`, real `0` preserved)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live URL returns 200 | DEP-01 | Requires a deployed Vercel URL; cannot run in Vitest node env | `curl -sI <vercel-url>` → expect `HTTP/2 200`; load CCN 686123 end-to-end in browser |
| Vercel one-time connect | DEP-01 | Agent cannot authenticate the user's Vercel account | User connects repo in Vercel dashboard, sets Root Directory = `medelite-report` |
| Repo public + pushed | DEP-02 | Requires GitHub state check | `gh repo view 1akashkalita/Infinite-Snapshot --json visibility` → `PUBLIC`; `git push` all local commits |

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (CCN pre-check, error mapping, `previousProviderPerformance`)
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter (by planner/auditor once map is task-bound)

**Approval:** pending
