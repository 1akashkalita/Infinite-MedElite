---
phase: 6
slug: docx-export
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-19
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `06-RESEARCH.md` § Validation Architecture. Final task IDs are assigned by the planner; the requirement→test rows below are the contract every plan task must map back to.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (node env) |
| **Config file** | `medelite-report/vitest.config.ts` (existing) |
| **Quick run command** | `npx vitest run tests/api/export-docx.test.ts` (from `medelite-report/`) |
| **Full suite command** | `npm run verify` (from `medelite-report/`) |
| **Phase gate** | `npm run verify:full` (adds `next build`) — mandatory; this phase adds a route + touches the bundle |
| **Estimated runtime** | ~15 seconds (test suite); build adds ~30–60s |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/api/export-docx.test.ts`
- **After every plan wave:** Run `npm run verify` (typecheck + lint + format:check + test)
- **Before `/gsd:verify-work`:** `npm run verify:full` must be green (catches `docx` bundling / server-only regressions that unit tests miss)
- **Max feedback latency:** ~15 seconds

---

## Per-Task Verification Map

> Task IDs (`6-NN-MM`) are finalized by the planner. Each automated assertion below MUST be claimed by exactly one plan task's `<acceptance_criteria>`.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| DOCX-01 | `POST /api/export/docx` with invalid body → 400 | unit | `npx vitest run tests/api/export-docx.test.ts -t "invalid body"` | ❌ W0 | ⬜ pending |
| DOCX-01 | 400 body is `{ error: { kind: "invalid_request", message } }` — no Zod internals | unit | `npx vitest run tests/api/export-docx.test.ts -t "error envelope"` | ❌ W0 | ⬜ pending |
| DOCX-01 | Non-JSON body → 400 (not raw 500) | unit | `npx vitest run tests/api/export-docx.test.ts -t "non-JSON"` | ❌ W0 | ⬜ pending |
| DOCX-01 | `POST` with valid `ReportViewModel` → 200 | unit | `npx vitest run tests/api/export-docx.test.ts -t "200 success"` | ❌ W0 | ⬜ pending |
| DOCX-01 | Body is a valid OOXML ZIP (PK magic bytes `50 4B 03 04`) | unit | `npx vitest run tests/api/export-docx.test.ts -t "PK magic bytes"` | ❌ W0 | ⬜ pending |
| DOCX-01 (SC#3) | `Buffer.byteLength(buffer) < 4_500_000` | unit | `npx vitest run tests/api/export-docx.test.ts -t "size limit"` | ❌ W0 | ⬜ pending |
| DOCX-01 (SC#3) | `Content-Type` = `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | unit | `npx vitest run tests/api/export-docx.test.ts -t "Content-Type"` | ❌ W0 | ⬜ pending |
| DOCX-01 (SC#3) | `Content-Disposition` has `filename=` ending `.docx` | unit | `npx vitest run tests/api/export-docx.test.ts -t "Content-Disposition"` | ❌ W0 | ⬜ pending |
| DOCX-01 / D-13 | `slugFilename(name, ccn, ".docx")` returns `.docx`; existing `.pdf` assertions stay green | unit | `npx vitest run tests/lib/slug.test.ts` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/api/export-docx.test.ts` — new file; covers every DOCX-01 automated assertion above
- [ ] `tests/lib/slug.test.ts` — extend existing file with `.docx`-extension assertions (no new file; do not weaken the PDF assertions)

*Builder/route/component source files (`src/lib/docx/ReportDocx.ts`, `src/app/api/export/docx/route.ts`, `src/components/ExportControls.tsx`) are implementation, not Wave 0 test infra.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| `.docx` opens cleanly in Microsoft Word AND Google Docs | DOCX-01 / SC#1 | Cross-application rendering fidelity (logo image, table borders, hyperlink) cannot be asserted from bytes alone | Run app, lookup CCN 686123, click "Download DOCX", open the file in Word and Google Docs |
| Content matches the live preview: static logo header, all 13 body fields, all 12 claims rows, clickable Medicare link to `.../nursing-home/686123` | DOCX-01 / SC#2 | Visual replication + clickable hyperlink behavior is a human judgment per template-fidelity rule | Compare the opened `.docx` side-by-side with the web preview / PDF; click the footer link |

---

## Validation Sign-Off

- [ ] All tasks have `<acceptance_criteria>` mapping to an automated verify above or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING test files (`export-docx.test.ts`, `slug.test.ts` extension)
- [ ] No watch-mode flags (all commands use `vitest run`)
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter (by gsd-nyquist-auditor at phase close)

**Approval:** pending
