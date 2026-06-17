---
phase: 2
slug: api-routes-view-model-config
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-17
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `02-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node environment) |
| **Config file** | `medelite-report/vitest.config.ts` (exists from Phase 1; globs `tests/**/*.test.ts` + `src/**/*.test.ts`, `@/* → ./src` alias) |
| **Quick run command** | `npx vitest run tests/api/` or `npx vitest run tests/lib/cms/` (by directory) |
| **Full suite command** | `npm run verify` (from `medelite-report/`) |
| **Estimated runtime** | ~5–15 seconds (node env, no running server) |

---

## Sampling Rate

- **After every task commit:** Run the relevant `npx vitest run tests/<dir>/` for the module touched.
- **After every plan wave:** Run `npm run verify` (typecheck → lint → format:check → test).
- **Before `/gsd:verify-work`:** `npm run verify:full` (adds `next build`) must be green — this is the phase gate.
- **Max feedback latency:** ~15 seconds.

---

## Per-Requirement Verification Map

Task IDs are assigned when plans are written; this maps each phase requirement (and the
high-risk CONTEXT decisions) to its automated proof. All test files are Wave 0 gaps — none
exist yet.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DATA-01 | GET /api/facility proxies CMS server-side, never browser | unit | `npx vitest run tests/api/facility.test.ts` | ❌ W0 | ⬜ pending |
| DATA-03 | Location composed from `provider_address`+`citytown`+`state`, no ZIP | unit | `npx vitest run tests/lib/report/format.test.ts` | ❌ W0 | ⬜ pending |
| DATA-04 | Quality star maps to `qm_rating` (not `longstay_qm_rating`/`shortstay_qm_rating`) | unit | `npx vitest run tests/lib/cms/mapper.test.ts` | ❌ W0 | ⬜ pending |
| DATA-05 | `number_of_certified_beds` mapped to `certifiedBeds` | unit | `npx vitest run tests/lib/cms/mapper.test.ts` | ❌ W0 | ⬜ pending |
| NAME-01 | `provider_name` used (NOT `legal_business_name`) — D-15 | unit | `npx vitest run tests/lib/cms/mapper.test.ts` | ❌ W0 | ⬜ pending |
| NAME-02 | Manual override respected in body; static header unaffected | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ❌ W0 | ⬜ pending |
| RPT-01 | `assembleHeader('FL')` returns exact static strings; no facility-name arg (compile-time) | unit | `npx vitest run tests/lib/report/header.test.ts` | ❌ W0 | ⬜ pending |
| RPT-02 | `assembleViewModel` deterministic; `generatedAt` injected; shared formatters | unit | `npx vitest run tests/lib/report/view-model.test.ts` | ❌ W0 | ⬜ pending |
| D-01 | 5 error kinds → correct HTTP status (400/404/502) | unit | `npx vitest run tests/api/facility.test.ts` | ❌ W0 | ⬜ pending |
| D-05 | `validation_error` response body contains ZERO Zod internals (leak invariant) | unit | `npx vitest run tests/api/facility.test.ts` | ❌ W0 | ⬜ pending |
| D-19 | 8s timeout → `network_error` | unit | `npx vitest run tests/lib/cms/client.test.ts` | ❌ W0 | ⬜ pending |
| D-21 | PDF stub: 400 on bad body shape, 501 on valid | unit | `npx vitest run tests/api/export-pdf.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files below must be created (no running server required — import the exported
`GET`/`POST` handler and pass a constructed `Request`; stub `global.fetch` with `vi.stubGlobal`):

- [ ] `tests/lib/cms/mapper.test.ts` — DATA-01, DATA-03, DATA-04, DATA-05, NAME-01
- [ ] `tests/lib/cms/client.test.ts` — D-18, D-19 (fetch stubs; `vi.stubGlobal('fetch', ...)`, `AbortError` mock)
- [ ] `tests/lib/cms/errors.test.ts` — `assertNever` exhaustiveness + `CmsError` construction
- [ ] `tests/lib/report/header.test.ts` — RPT-01; negative: facility name never appears in output
- [ ] `tests/lib/report/view-model.test.ts` — NAME-02, RPT-02; `generatedAt` as parameter (deterministic)
- [ ] `tests/lib/report/format.test.ts` — DATA-03, D-08..D-11; null→"N/A", `=== null` not `if (!v)` (the `0` trap)
- [ ] `tests/api/facility.test.ts` — DATA-01, D-01, D-05 (leak invariant); `new Request(url)`
- [ ] `tests/api/export-pdf.test.ts` — D-21 (400 bad shape, 501 valid)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `serverExternalPackages` actually applied to the standalone build | D-25 | Turbopack bug #88844 can omit it from standalone output; only a real build surfaces it | Run `npm run verify:full` and confirm `next build` completes without the react-pdf bundling error |

*All other phase behaviors have automated verification.*

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (use `vitest run`, never bare `vitest`)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
