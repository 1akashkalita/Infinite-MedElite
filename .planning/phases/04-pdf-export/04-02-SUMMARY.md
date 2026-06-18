---
phase: 04-pdf-export
plan: 02
subsystem: pdf
tags: [download-button, client-component, blob-download, D-07, D-08, pdf-01]

# Dependency graph
requires:
  - phase: 04-pdf-export plan 01
    provides: POST /api/export/pdf returns 200 application/pdf (renderToBuffer)
  - phase: 03-web-ui-core-flow-deployment
    provides: SnapshotApp.tsx with assembled vm, left-pane layout
provides:
  - DownloadPdfButton: client fetch POST → Blob → anchor download, D-07 states, D-08 inline error
  - SnapshotApp left pane mounts DownloadPdfButton fed the assembled vm
affects:
  - End-to-end PDF-01: click → direct download now complete

# Tech tracking
tech-stack:
  added: []
  patterns:
    - fetch POST → resp.blob() → URL.createObjectURL → programmatic <a download> → revokeObjectURL
    - useState(false) for loading + useState<string|null>(null) for inline export error
    - disabled={loading || !vm} guards button until vm exists (D-07)
    - inline <p role="alert"> for export errors; never ErrorBanner (D-08)

key-files:
  created:
    - medelite-report/src/components/DownloadPdfButton.tsx
  modified:
    - medelite-report/src/components/SnapshotApp.tsx

key-decisions:
  - "DownloadPdfButton wraps button + error region in a <div className=flex flex-col gap-1> to keep the inline error visually attached to the button"
  - "Both loading===true and vm===null render bg-blue-300 cursor-not-allowed; identical CCNSearchBar disabled-styling pattern reused"
  - "No new packages — all browser APIs (fetch, URL.createObjectURL) are native; @react-pdf/renderer never imported client-side"

# Metrics
duration: 10min
completed: 2026-06-18
---

# Phase 04 Plan 02: Download PDF Button Summary

**Client-side "Download PDF" button that POSTs the assembled ReportViewModel, receives a Blob, and triggers a silent anchor download with D-07 disabled/"Generating…" states and D-08 inline retry error**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-18
- **Completed:** 2026-06-18
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Created `DownloadPdfButton.tsx`: `"use client"` component, POSTs assembled `ReportViewModel` to `/api/export/pdf`, receives PDF Blob, triggers silent anchor download via `URL.createObjectURL` + programmatic `<a download>` click + revoke (D-05)
- D-07 states: button disabled + label "Generating…" while request in flight; also disabled when `vm` is null (no successful facility fetch yet)
- D-08 inline error: `<p role="alert" className="text-sm text-red-600 mt-1">` below the button on any export failure; button stays enabled for retry; ErrorBanner not used
- T-03-09 / PITFALLS #4: no import of `@react-pdf/renderer` or `ReportPDF` in `DownloadPdfButton.tsx` or `SnapshotApp.tsx`
- Mounted `<DownloadPdfButton vm={vm} />` in `SnapshotApp.tsx` left pane, after `<ManualInputsForm>`, fed the already-assembled `vm` from state
- `npm run verify:full` exits 0: typecheck + lint + format:check + test (157 passed) + `next build` — client bundle does not pull in `@react-pdf/renderer` through the new button (SC#5 / PITFALLS #4 confirmed by successful build)

## Task Commits

1. **Task 1: DownloadPdfButton (D-05/D-07/D-08)** - `de1b223` (feat)
2. **Task 2: Mount DownloadPdfButton in SnapshotApp left pane** - `dcfbedb` (feat)

## Files Created/Modified

- `medelite-report/src/components/DownloadPdfButton.tsx` — Client download button: fetch POST → Blob → anchor download, D-07 states, D-08 inline error; NO import of server-only modules
- `medelite-report/src/components/SnapshotApp.tsx` — Added `DownloadPdfButton` import and `<DownloadPdfButton vm={vm} />` after `<ManualInputsForm>` in left pane

## Decisions Made

1. **Wrapper div for button + error region**: The button and inline error `<p>` are wrapped in `<div className="flex flex-col gap-1">` — mirrors the `CCNSearchBar` pattern of a flex-column form container keeping the inline error visually attached to the action element.

2. **Disabled styling uses same condition for both states**: `disabled={loading || !vm}` and the className condition `loading || !vm ? "cursor-not-allowed bg-blue-300" : ...` uses the same compound expression so visual state always matches the `disabled` attribute — no divergence risk.

3. **No new packages**: All browser APIs used (`fetch`, `URL.createObjectURL`, `document.createElement`) are native; the component has only two imports (`useState` from react, `ReportViewModel` type from view-model).

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None. `DownloadPdfButton` is fully functional — real fetch → blob → download flow wired to the live `/api/export/pdf` route from Plan 04-01.

## Threat Flags

No new threat surface beyond the plan's threat model:
- T-04-05 (Tampering: client POST body): The button passes the in-state `vm` to the server; the route's `ReportViewModelSchema.safeParse` (Plan 04-01) is the authoritative validation gate. A tampered body fails server-side → 400; button surfaces generic inline retry error (no internals leaked).
- T-04-06 (Build integrity): Source assertions confirmed — neither `DownloadPdfButton.tsx` nor `SnapshotApp.tsx` imports `@react-pdf/renderer` or `ReportPDF`; `next build` passes clean.
- T-04-07 (Information Disclosure): Fixed UI-authored string ("Couldn't generate PDF — try again.") rendered on error; raw server response never exposed.

## Self-Check: PASSED

- [x] `medelite-report/src/components/DownloadPdfButton.tsx` — FOUND
- [x] `medelite-report/src/components/SnapshotApp.tsx` (modified) — FOUND
- [x] `.planning/phases/04-pdf-export/04-02-SUMMARY.md` — FOUND
- [x] Commit `de1b223` (Task 1: DownloadPdfButton) — FOUND
- [x] Commit `dcfbedb` (Task 2: SnapshotApp mount) — FOUND
- [x] `npm run verify:full` exits 0 — CONFIRMED

---
*Phase: 04-pdf-export*
*Completed: 2026-06-18*
