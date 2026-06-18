---
status: partial
phase: 04-pdf-export
source: [04-VERIFICATION.md]
started: 2026-06-18T01:34:00Z
updated: 2026-06-18T01:34:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. PDF viewer content and header check
expected: With the app running (CCN 686123 loaded), click "Download PDF" and open the file in a PDF viewer (Preview, Adobe Reader, Chrome). Header reads exactly "INFINITE — Managed by MEDELITE" / "FACILITY ASSESSMENT SNAPSHOT" / "FL". Facility name appears only in the body under "Name of Facility". All 13 fields are populated; footer shows the CMS processing date.
result: [pending]

### 2. Clickable Medicare link in PDF viewer
expected: Clicking "View official CMS profile on Medicare.gov" in the PDF opens https://www.medicare.gov/care-compare/details/nursing-home/686123 in a browser.
result: [pending]

### 3. PDF content matches web preview
expected: With CCN 686123 loaded and all manual fields populated, a side-by-side comparison of the web preview and the downloaded PDF shows identical field values — manual inputs, star ratings, location, census capacity, and N/A for any null field.
result: [pending]

### 4. Download button states (D-07)
expected: On click, the button immediately disables and the label changes to "Generating…" for the duration of the request, then re-enables with "Download PDF" after the file downloads.
result: [pending]

### 5. Inline error on failure (D-08)
expected: On an export failure, a small red message "Couldn't generate PDF — try again." appears below the button; the button stays enabled for retry; no top ErrorBanner appears.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
