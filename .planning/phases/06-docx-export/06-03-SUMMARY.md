---
phase: "06-docx-export"
plan: "03"
subsystem: "export-controls"
tags: ["ExportControls", "docx", "pdf", "DOCX-01", "D-01", "D-02", "D-03", "D-04", "D-05", "checkpoint-fix", "logo-sizing", "preview-width"]
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
    - "Word-readable .docx: logo sized in px (not EMU) so wp:extent is sane"
    - "Consistent US-Letter-width preview across all render states"
  affects:
    - "medelite-report/src/components/ExportControls.tsx"
    - "medelite-report/src/components/SnapshotApp.tsx"
    - "medelite-report/src/lib/docx/ReportDocx.ts"
    - "medelite-report/src/components/ReportPreview.tsx"
    - "medelite-report/src/components/pdf/ReportPDF.tsx"
    - "medelite-report/src/app/layout.tsx"
    - "medelite-report/tests/api/export-docx.test.ts"
tech_stack:
  added: []
  patterns:
    - "Segmented toggle with aria-pressed for format selection (D-01/D-03)"
    - "Format-aware fetch URL: /api/export/${format} (D-05)"
    - "WR-02 deferred revokeObjectURL via setTimeout(fn, 0)"
    - "D-08 inline role=alert error — never ErrorBanner; button stays enabled to retry"
    - "T-06-08 discipline: ExportControls imports only ReportViewModel as a type (never docx/ReportDocx/@react-pdf)"
    - "docx transformation in pixels (not EMU) — docx internally multiplies px×9525"
    - "JSZip regression test: unzip .docx and assert wp:extent cx < 10_000_000 EMU"
    - "US-Letter preview cap: mx-auto w-full max-w-[816px] on all three render-state divs"
key_files:
  created:
    - "medelite-report/src/components/ExportControls.tsx"
  modified:
    - "medelite-report/src/components/SnapshotApp.tsx"
    - "medelite-report/src/lib/docx/ReportDocx.ts"
    - "medelite-report/src/components/ReportPreview.tsx"
    - "medelite-report/src/components/pdf/ReportPDF.tsx"
    - "medelite-report/src/app/layout.tsx"
    - "medelite-report/tests/api/export-docx.test.ts"
decisions:
  - "D-02: DownloadPdfButton replaced by unified ExportControls — format state + in-flight/error states in one component"
  - "D-03: PDF is the default pre-selected format (toggle starts on PDF)"
  - "D-04: Button label dynamically reads 'Download PDF'/'Download DOCX'/'Generating…'"
  - "D-05: Same silent anchor download mechanics for both formats (WR-02 deferred revoke)"
  - "T-06-08: ExportControls never imports docx/Packer/buildReportDocx — confirmed by next build passing"
  - "DownloadPdfButton.tsx left in place (not deleted) — it is simply no longer referenced"
  - "DOCX-EMU-01: docx transformation.width/height are PIXELS not EMU; docx multiplies px×9525 internally"
  - "PREVIEW-WIDTH: preview capped at 816px (US-Letter 8.5in at 96 DPI) via max-w-[816px] on all three states"
  - "LABEL-01: footer label changed to 'CMS dataset processing date' across all three renderers for clarity"
  - "TITLE-01: page title changed to 'Infinite — Medelite' for brand context"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-19T22:01:00Z"
  tasks: 5
  files: 7
---

# Phase 06 Plan 03: Unified ExportControls Component Summary

## One-liner

Replaced `DownloadPdfButton` with `ExportControls` (PDF|DOCX toggle), fixed a Word-breaking EMU/px logo bug in the .docx builder, added a JSZip regression test that guards the image extent, relabeled the footer date, capped the preview to US-Letter width, and updated the page title — `npm run verify` fully green; Task 3 human UAT **awaiting re-verification** with the fixed .docx.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 | Build the unified ExportControls component (D-01..D-05) | 1ea95c0 | `src/components/ExportControls.tsx` (created) |
| 2 | Swap ExportControls into SnapshotApp and run the phase gate | 0e86ed7 | `src/components/SnapshotApp.tsx` (modified) |
| 3 | Human UAT — awaiting re-verification after checkpoint fix | — | See below |

### Checkpoint fix commits (continuation agent)

| Fix | Commit | Files |
|-----|--------|-------|
| FIX 1: Size docx logo in px not EMU | 95cac2f | `src/lib/docx/ReportDocx.ts` |
| FIX 2: Add image extent regression test | 7f71a7f | `tests/api/export-docx.test.ts` |
| FIX 3: Relabel footer to "CMS dataset processing date" | 23f870f | `ReportPreview.tsx`, `ReportPDF.tsx`, `ReportDocx.ts` |
| FIX 4: Cap preview to US-Letter width | 080ce9d | `src/components/ReportPreview.tsx` |
| FIX 5: Set page title to "Infinite — Medelite" | e1c98f9 | `src/app/layout.tsx` |

## What Was Built

### Task 1: ExportControls component

Created `src/components/ExportControls.tsx` as a `"use client"` component with:

- **`PDF | DOCX` segmented toggle** (D-01/D-03): `<div role="group" aria-label="Export format">` containing two `<button type="button">` with `aria-pressed={format === f}`, `disabled={loading}`, and Tailwind styling. PDF is the pre-selected default.
- **Format-aware `handleDownload`** (D-05): `fetch(\`/api/export/${format}\`, ...)` — URL tracks selected format. Silent anchor download via `URL.createObjectURL` + `setTimeout(() => URL.revokeObjectURL(url), 0)` (WR-02).
- **Format-tracking button label** (D-04): reads "Download PDF" / "Download DOCX" / "Generating…".
- **D-07**: `disabled={loading || !vm}`.
- **D-08 inline error**: `<p role="alert">` with a fixed UI-authored string. Never ErrorBanner.
- **T-06-08 discipline**: only `import type { ReportViewModel }`.

### Task 2: SnapshotApp swap + phase gate

Replaced `DownloadPdfButton` with `ExportControls` in SnapshotApp; `npm run verify:full` green including `next build`.

### FIX 1: Logo sizing bug (checkpoint blocker)

**Root cause:** `ReportDocx.ts` passed EMU values to `ImageRun.transformation.width/height`. The `docx` library treats those as pixels and multiplies by 9525 internally, producing `wp:extent cx ≈ 17,419,320,000` EMU (~0.3 mile). Word refuses files with extents that large.

**Fix:** Replaced `LOGO_DISPLAY_W_EMU = 1_828_800` with `LOGO_DISPLAY_W_PX = 192`. At 192 px the library produces `cx = 192 × 9525 = 1,828,800` EMU (~2 inches) — correct and Word-readable.

### FIX 2: Image extent regression test

Added a test in `tests/api/export-docx.test.ts` that:
1. Calls `buildReportDocx(validVm)` + `Packer.toBuffer()` to get the raw ZIP buffer.
2. Uses `JSZip.loadAsync()` to unzip and read `word/document.xml`.
3. Extracts all `wp:extent cx="..."` values and asserts each is a positive integer and `< 10_000_000 EMU` (~11 inches).
4. Would have failed against the old EMU bug (cx ~17 billion).

### FIX 3: Footer label relabel

Changed `"CMS processing date:"` to `"CMS dataset processing date:"` in all three renderers (ReportPreview.tsx, ReportPDF.tsx, ReportDocx.ts). The date value `formatDate(f.processingDate)` is unchanged in all three. No test asserted the old label string.

### FIX 4: Preview width cap

Added `mx-auto w-full max-w-[816px]` to the success `<article>`, loading skeleton div, and empty/error placeholder div in `ReportPreview.tsx`. 816px ≈ 8.5in at 96 DPI (US-Letter width). Height flows freely — no fixed aspect-ratio. Consistent across all three states prevents layout jumps.

### FIX 5: Page title

Changed `metadata.title: "Infinite"` to `"Infinite — Medelite"` in `src/app/layout.tsx`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Prettier formatting fix**
- **Found during:** Task 2 (verify:full)
- **Issue:** `ExportControls.tsx` formatting
- **Fix:** `npx prettier --write src/components/ExportControls.tsx`
- **Commit:** Included in `0e86ed7`

**2. [Rule 1 - Bug] docx logo EMU/px confusion — checkpoint blocker fixed**
- **Found during:** Human UAT (Task 3 checkpoint)
- **Issue:** `ImageRun.transformation` takes pixels; code was passing EMU (1,828,800). Library multiplied by 9525 → `wp:extent cx ≈ 17,419,320,000 EMU`. Word rejected the file.
- **Fix:** Changed to `LOGO_DISPLAY_W_PX = 192`; correct extent 1,828,800 EMU.
- **Files modified:** `src/lib/docx/ReportDocx.ts`
- **Commit:** 95cac2f
- **Regression guard:** JSZip test added (commit 7f71a7f)

### Polish Fixes (user-requested, continuation agent)

**3. [User request] Footer label "CMS dataset processing date"**
- Applied to ReportPreview.tsx, ReportPDF.tsx, ReportDocx.ts (commit 23f870f)

**4. [User request] Preview capped to US-Letter width**
- Added `mx-auto w-full max-w-[816px]` on all three render-state containers (commit 080ce9d)

**5. [User request] Page title "Infinite — Medelite"**
- layout.tsx metadata.title updated (commit e1c98f9)

## Checkpoint: Human UAT Required (re-verification after fix)

Task 3 remains a `checkpoint:human-verify` gate. The EMU/px bug that caused Word to reject the file has been fixed and regression-guarded. The human must now re-verify:

**What was fixed:** `LOGO_DISPLAY_W_EMU = 1_828_800` → `LOGO_DISPLAY_W_PX = 192`. The generated .docx now has a sane image extent (~2 inches wide).

**Re-verification steps:**
1. From `medelite-report/`, run `npm run dev` and open http://localhost:3000.
2. Enter CCN `686123`, submit, wait for the preview to populate.
3. Flip the toggle to DOCX, click "Download DOCX".
4. Open the downloaded `.docx` in Microsoft Word AND Google Docs.
5. Confirm: opens cleanly (no repair prompt); static INFINITE header visible; 13 body fields + 12 hospitalization/ED rows present; footer link clickable.
6. Confirm content matches the live web preview.

**Status:** Awaiting human re-verification.

## Known Stubs

None. `ExportControls` is fully functional.

## Threat Surface Scan

No new network endpoints or auth paths introduced by the continuation fixes. All changes are local to existing files within already-modelled trust boundaries.

## Self-Check: PASSED

- `medelite-report/src/components/ExportControls.tsx` — exists (created)
- `medelite-report/src/components/SnapshotApp.tsx` — exists (modified)
- `medelite-report/src/lib/docx/ReportDocx.ts` — exists (FIX 1 applied: LOGO_DISPLAY_W_PX)
- `medelite-report/tests/api/export-docx.test.ts` — exists (FIX 2: extent regression test)
- `medelite-report/src/components/ReportPreview.tsx` — exists (FIX 3 + FIX 4 applied)
- `medelite-report/src/components/pdf/ReportPDF.tsx` — exists (FIX 3 applied)
- `medelite-report/src/app/layout.tsx` — exists (FIX 5 applied)
- Commits: 1ea95c0, 0e86ed7, 00ad05b, 95cac2f, 7f71a7f, 23f870f, 080ce9d, e1c98f9
- `npm run verify` — exit 0 (259 tests passed, 1 skipped)
