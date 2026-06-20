# Phase 6: .docx Export - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-19
**Phase:** 6-.docx Export
**Areas discussed:** Download button UX

---

## Gray-area selection

Four candidate gray areas were presented (multi-select). Only **Download button UX** was selected for discussion; the other three were left to carry-forward / Claude's-discretion defaults (recorded in CONTEXT.md D-06..D-11).

| Candidate area | Description | Selected for discussion |
|----------------|-------------|-------------------------|
| Download button UX | Two buttons vs. one control with a format choice | ✓ |
| Layout fidelity bar | Pixel-faithful PDF replica vs. Word-native styling | (defaulted: faithful replica, D-06) |
| Shared row model | Extract one cross-renderer row descriptor vs. hand-port rows | (defaulted: hand-port, D-07) |
| Hyperlink & metadata | Clickable styled Medicare link + doc title property | (defaulted: yes, D-10/D-11) |

---

## Download button UX

### Q1 — How should the user choose between PDF and DOCX?

| Option | Description | Selected |
|--------|-------------|----------|
| Two separate buttons | 'Download PDF' + 'Download DOCX' side-by-side; mirrors existing DownloadPdfButton, lowest risk (Recommended) | |
| One button + format toggle | A single 'Download' with a PDF/DOCX toggle/dropdown; more compact, adds selection state | ✓ |
| Split/dropdown button | Primary 'Download PDF' with a caret revealing 'Download DOCX' | |

**User's choice:** One button + format toggle.
**Notes:** Chose the more compact unified control over the simpler two-button carry-forward.

### Q2 — What should the format selector look like?

| Option | Description | Selected |
|--------|-------------|----------|
| Segmented toggle (PDF \| DOCX) | Two-segment pill, one format always visibly selected, beside Download (Recommended) | ✓ |
| Dropdown `<select>` | Native select; most compact, current choice hidden until opened | |
| Radio buttons | Two labeled radios above Download; explicit but most vertical space | |

**User's choice:** Segmented toggle (PDF | DOCX).

### Q3 — How to restructure the PDF-only DownloadPdfButton?

| Option | Description | Selected |
|--------|-------------|----------|
| Replace with unified control | Refactor into one 'ExportControls' (toggle + Download) owning format state + shared loading/error logic; POSTs to the right route (Recommended) | ✓ |
| Keep PDF button, add toggle wrapper | Leave DownloadPdfButton intact, wrap with a format-aware parent; less rewrite, splits state | |

**User's choice:** Replace with unified control.

### Q4 — Default selected format and the Download button's label?

| Option | Description | Selected |
|--------|-------------|----------|
| PDF default, label reflects format | PDF pre-selected; button reads 'Download PDF' / 'Download DOCX', 'Generating…' in flight (Recommended) | ✓ |
| PDF default, generic 'Download' label | PDF pre-selected; button always reads 'Download'; toggle alone signals format | |

**User's choice:** PDF default, label reflects format.

---

## Claude's Discretion

- Layout fidelity → faithful replica of the PDF/preview using native `docx` table + `ImageRun` (D-06).
- Row structure → hand-port the 13 + 12 rows mirroring `ReportPDF` (no shared descriptor this phase) (D-07).
- Medicare link → clickable `ExternalHyperlink`, blue/underlined, same label as PDF (D-10); doc title = `displayName` (D-11).
- Builder file location/shape, `ExportControls` markup/styling, `docx` styling specifics, US Letter page setup.

## Deferred Ideas

- Shared cross-renderer row-descriptor for preview/PDF/`.docx` (reduce triplication) — future refactor.
- Star-rating cards/charts in `.docx`, registered custom font, full Vercel smoke checklist + 300ms debounce → Phase 7.
