---
phase: "06-docx-export"
plan: "03"
subsystem: "export-controls"
tags: ["ExportControls", "docx", "pdf", "DOCX-01", "D-01", "D-02", "D-03", "D-04", "D-05"]
dependency_graph:
  requires:
    - "POST /api/export/docx — 06-02"
    - "POST /api/export/pdf — Phase 04"
    - "ReportViewModel — Phase 02"
    - "DownloadPdfButton download/blob/error logic — Phase 04"
  provides:
    - "ExportControls: unified PDF|DOCX toggle + Download button (D-01..D-05)"
    - "SnapshotApp left pane wired to ExportControls (replaces DownloadPdfButton)"
    - "DOCX-01 fully closed at the code level — end-to-end browser download flow"
  affects:
    - "medelite-report/src/components/ExportControls.tsx"
    - "medelite-report/src/components/SnapshotApp.tsx"
tech_stack:
  added: []
  patterns:
    - "Segmented toggle with aria-pressed for format selection (D-01/D-03)"
    - "Format-aware fetch URL: /api/export/${format} (D-05)"
    - "WR-02 deferred revokeObjectURL via setTimeout(fn, 0)"
    - "D-08 inline role=alert error — never ErrorBanner; button stays enabled to retry"
    - "T-06-08 discipline: ExportControls imports only ReportViewModel as a type (never docx/ReportDocx/@react-pdf)"
key_files:
  created:
    - "medelite-report/src/components/ExportControls.tsx"
  modified:
    - "medelite-report/src/components/SnapshotApp.tsx"
decisions:
  - "D-02: DownloadPdfButton replaced by unified ExportControls — format state + in-flight/error states in one component"
  - "D-03: PDF is the default pre-selected format (toggle starts on PDF)"
  - "D-04: Button label dynamically reads 'Download PDF'/'Download DOCX'/'Generating…'"
  - "D-05: Same silent anchor download mechanics for both formats (WR-02 deferred revoke)"
  - "T-06-08: ExportControls never imports docx/Packer/buildReportDocx — confirmed by next build passing"
  - "DownloadPdfButton.tsx left in place (not deleted) — it is simply no longer referenced"
metrics:
  duration: "~8 minutes"
  completed: "2026-06-20T01:10:44Z"
  tasks: 3
  files: 2
---

# Phase 06 Plan 03: Unified ExportControls Component Summary

## One-liner

Replaced `DownloadPdfButton` with `ExportControls` — a unified `PDF | DOCX` segmented toggle (PDF pre-selected) + format-tracking Download button that POSTs the assembled `vm` to `/api/export/${format}` and silent-anchor-downloads the blob for both formats, with `npm run verify:full` green including `next build` proving no server-only docx import reached the client bundle (DOCX-01 end-to-end).

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Build the unified ExportControls component (D-01..D-05) | 1ea95c0 | `src/components/ExportControls.tsx` (created) |
| 2 | Swap ExportControls into SnapshotApp and run the phase gate | 0e86ed7 | `src/components/SnapshotApp.tsx` (modified), `src/components/ExportControls.tsx` (format fix) |
| 3 | Human UAT — Download DOCX opens cleanly in Word and Google Docs | — | Paused at checkpoint (awaiting human verification) |

## What Was Built

### Task 1: ExportControls component

Created `src/components/ExportControls.tsx` as a `"use client"` component with:

- **`PDF | DOCX` segmented toggle** (D-01/D-03): `<div role="group" aria-label="Export format">` containing two `<button type="button">` with `aria-pressed={format === f}`, `disabled={loading}`, and Tailwind styling (bg-blue-600 when selected, bg-white otherwise). PDF is the pre-selected default.
- **Format-aware `handleDownload`** (D-05): `fetch(\`/api/export/${format}\`, ...)` — URL tracks selected format. Silent anchor download via `URL.createObjectURL` + programmatic `<a download>` click + `setTimeout(() => URL.revokeObjectURL(url), 0)` (WR-02 deferred revoke verbatim from DownloadPdfButton).
- **Format-tracking button label** (D-04): `{loading ? "Generating…" : \`Download ${format.toUpperCase()}\`}` — reads "Download PDF" / "Download DOCX" / "Generating…".
- **D-07**: `disabled={loading || !vm}` — button disabled until vm exists.
- **D-08 inline error**: `<p role="alert" className="text-sm text-red-600 mt-1">` below the control, fixed UI-authored string (`Couldn't generate PDF/DOCX — try again.`), button stays enabled. Never routed through `ErrorBanner`.
- **T-06-08 discipline**: no `docx`, `Packer`, `buildReportDocx`, `@react-pdf/renderer`, or `ReportPDF` import — only `import type { ReportViewModel }`.

### Task 2: SnapshotApp swap + phase gate

Modified `SnapshotApp.tsx`:
- Replaced `import { DownloadPdfButton } from "@/components/DownloadPdfButton"` with `import { ExportControls } from "@/components/ExportControls"`
- Replaced `<DownloadPdfButton vm={vm} />` with `<ExportControls vm={vm} />`
- Updated adjacent comment to reference T-06-08 and ExportControls discipline

`npm run verify:full` result: **all green** — typecheck + lint + format:check + 258 tests (1 skipped) + `next build`. The build output confirms `/api/export/docx` and `/api/export/pdf` are both dynamic server routes, and no bundling regression was introduced. The server-only docx builder (`ReportDocx.ts`) never reached the client bundle.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier formatting fix**
- **Found during:** Task 2 (verify:full)
- **Issue:** `ExportControls.tsx` had a multi-line string expression that Prettier reformatted
- **Fix:** Ran `npx prettier --write src/components/ExportControls.tsx` — the expression `\`Couldn't generate ${format.toUpperCase()} — try again.\`` was folded to one line; minor whitespace fix only
- **Files modified:** `src/components/ExportControls.tsx`
- **Commit:** Included in commit `0e86ed7` (staged together with SnapshotApp)

No other deviations — plan executed as written.

## Known Stubs

None. `ExportControls` is fully functional: the toggle switches formats, the button POSTs to the correct route, the blob is downloaded silently.

## Threat Surface Scan

`ExportControls.tsx` introduces a new client-side POST to `/api/export/${format}` — already accounted for in the plan's threat model:

| Threat | Mitigation | Status |
|--------|-----------|--------|
| T-06-08: docx/ReportDocx reaching client bundle via ExportControls | Only `import type { ReportViewModel }` — confirmed by `next build` passing | Implemented + build-verified |
| T-06-09: export failure disclosing server internals | Fixed UI-authored string, never raw server response | Implemented |
| T-06-10: concurrent export DoS | Single shared `loading` flag disables button and toggle while in-flight | Implemented |

## Checkpoint: Human UAT Required

Task 3 is a `checkpoint:human-verify` gate (non-auto). Execution paused here.

**What was automated:** Tasks 1–2 complete, `npm run verify:full` green including `next build`.

**What requires human verification:** Open the running app, flip the toggle to DOCX, download, open in Word AND Google Docs — confirm content matches preview (static header, 13 body fields, 12 claims rows, clickable Medicare link).

## Self-Check: PASSED

- `medelite-report/src/components/ExportControls.tsx` — exists, created
- `medelite-report/src/components/SnapshotApp.tsx` — exists, modified (imports ExportControls, not DownloadPdfButton)
- Commit `1ea95c0` — found in git log
- Commit `0e86ed7` — found in git log
- `npm run verify:full` — exit 0 (all green)
