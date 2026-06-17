---
phase: 1
slug: foundation-cms-data-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-16
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: 01-RESEARCH.md § Validation Architecture (verified against installed `vitest@4.1.9` / `zod@4.4.3`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 (node env) |
| **Config file** | `medelite-report/vitest.config.ts` (globs `tests/**/*.test.ts`, `src/**/*.test.ts`) |
| **Quick run command** | `npx vitest run tests/lib/cms/schema.test.ts` |
| **Full suite command** | `npm run verify` (typecheck → lint → format:check → test) |
| **Estimated runtime** | ~15 seconds (full gate); ~2s (single schema test) |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/lib/cms/schema.test.ts`
- **After every plan wave:** Run `npm run verify` (full gate)
- **Before `/gsd:verify-work`:** `npm run verify` must be green
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Task IDs are assigned by the planner; the requirement→test map below is the contract each task must satisfy. Every DATA-02 / DATA-06 assertion lands in `tests/lib/cms/schema.test.ts`.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DATA-02 | Zod parse succeeds on the 686123 reference fixture row | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | Suppressed `""` → `null` (NOT `0`) before coercion | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | Real `"0"` → `0` (legitimate zero preserved) | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | Missing required (depended-on) key → `safeParse` fails loudly | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ W0 | ⬜ pending |
| DATA-02 | CCN (and ZIP) preserve leading zeros as `string` | unit | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ W0 | ⬜ pending |
| DATA-06 | Every field name in the schema matches a key in `provider-686123.json` | unit (schema-as-test) | `npx vitest run tests/lib/cms/schema.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/` directory — created by `npm run fixture:capture` (first action in phase; dir does not yet exist)
- [ ] `tests/fixtures/provider-686123.json` — captured (required by ROADMAP SC#1)
- [ ] `tests/fixtures/claims-686123.json` — captured (anchors Phase 5 field names)
- [ ] `tests/fixtures/averages-xcdc.json` — captured (NATION + FL rows)
- [ ] Malformed fixtures (missing-key / suppressed-to-null / wrong-shape) — for error-path tests (D-12)
- [ ] `tests/lib/cms/schema.test.ts` — new; covers all DATA-02 + DATA-06 assertions
- [ ] `src/lib/cms/schema.ts` — new; implements `CMSRowSchema`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live CMS API capture returns valid JSON for CCN 686123 | DATA-06 | Hits the live CMS Provider Data Catalog (network-dependent; confined to `npm run fixture:capture` + one env-gated smoke test per D-11) | Run `npm run fixture:capture`; confirm 3 fixtures written and `provider-686123.json` contains a row with `cms_certification_number_ccn == "686123"` |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify command or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (fixtures + schema test file)
- [ ] No watch-mode flags (CI-safe: `vitest run`, not `vitest`)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner maps task IDs)

**Approval:** pending
