---
phase: 06-docx-export
reviewed: 2026-06-20T09:50:21Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - medelite-report/src/lib/docx/ReportDocx.ts
  - medelite-report/src/app/api/export/docx/route.ts
  - medelite-report/src/lib/report/slug.ts
  - medelite-report/src/components/ExportControls.tsx
  - medelite-report/src/components/CCNSearchBar.tsx
  - medelite-report/src/components/SnapshotApp.tsx
  - medelite-report/src/components/ReportPreview.tsx
  - medelite-report/src/components/pdf/ReportPDF.tsx
  - medelite-report/src/app/layout.tsx
  - medelite-report/tests/api/export-docx.test.ts
  - medelite-report/tests/lib/slug.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-20T09:50:21Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase adds a `.docx` export that fills the official Word template via JSZip + OOXML
string manipulation (`buildReportDocxBuffer` in `ReportDocx.ts`), wires a new POST
`/api/export/docx` route, generalizes `slugFilename` with an `ext` parameter, and replaces
the single PDF download button with a unified `ExportControls` (PDF | DOCX) component.

The route's Zod validation and clean error envelope are correct (no Zod internals leak), the
`slugFilename` allowlist sanitization is solid and well-tested, the careCompareUrl schema refine
(protocol + hostname) bounds the rels Target host, and `ExportControls` correctly avoids importing
any server-only module. Those concerns from the brief check out.

However, the OOXML template-fill has a **confirmed BLOCKER**: every value injected into the
document is escaped for XML special characters (`& < > " '`) but **not** for the JavaScript
`String.prototype.replace` replacement-pattern metacharacters (`$$`, `$&`, `` $` ``, `$'`, `$n`).
Because the escaped value is interpolated into the *replacement string* of two `.replace()` calls,
a value containing `$` produces corrupt, unbalanced OOXML — Word will refuse to open the file or
render it incorrectly. This is reachable from ordinary user input (any manual free-text field, the
facility-name override, or the CCN) and is not caught by the existing tests because the fixture
contains no `$`. Details and a reproduction are in CR-01.

## Critical Issues

### CR-01: `$`-replacement-pattern corruption in OOXML template fill (escaping is incomplete)

**File:** `medelite-report/src/lib/docx/ReportDocx.ts:160-165`, `:201-204`, `:184-185`

**Issue:**
`xmlEsc()` (lines 45-52) escapes the five XML special characters but does **not** escape the
dollar sign. The escaped value is then placed into the **replacement-string position** of
`String.prototype.replace()`, where `$` sequences (`$$`, `$&`, `` $` ``, `$'`, `$1`…) are special
and get expanded against the match. This corrupts the OOXML.

Two confirmed corruption sites:

1. **Value cell fill (lines 160-165):**
   ```js
   const newValTag = originalValTag.replace(
     /(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/,
     `$1${xmlEsc(value)}$2`,   // attacker $ inside xmlEsc(value) is re-interpreted
   );
   return row.replace(originalValTag, newValTag); // newValTag is ALSO a string replacement → $ re-interpreted again
   ```
   Reproduced with `value = "Acme $\` $& $1 Center"`:
   produced `<w:t>Acme  <w:t>placeholder</w:t>amp; <w:t> Center</w:t>` — nested/unbalanced
   `<w:t>` tags, i.e. corrupt OOXML.

2. **Rels relationship injection (lines 201-204):**
   ```js
   rels = rels.replace(
     "</Relationships>",
     `<Relationship ... Target="${xmlEsc(f.careCompareUrl)}" .../></Relationships>`,
   );
   ```
   The careCompareUrl path segment is the CCN, validated only as `z.string()` (the URL refine
   checks protocol + hostname, not the path). Reproduced with a CCN ending in `$&`:
   the `$&` re-inserted `</Relationships>`, splitting the relationships file.

   (The footer injection at lines 184-185 has the same shape — `footerP` carries
   `xmlEsc(formatDate(f.processingDate))` into a `.replace()` replacement string. Lower risk
   because `processingDate` is a date string, but it shares the defect class.)

**Reachability:** `displayName` derives from `manual.nameOverride` (free text), and `emr`,
`typeOfPatient`, `medicalCoverage`, `previousProviderPerformance` are all `z.string()` with no
`.max()` and no character allowlist (see `view-model.ts:130-137`). The CCN is `z.string()` too.
A user who simply types a price like `"Cost: $5/visit"` or `"PCP & $upport"` in a manual field
triggers it — no malicious intent required.

**Fix:** Escape `$` for the replacement-string position (or avoid string-replacement semantics).
The minimal, robust fix is to neutralize `$` in any value that lands in a replacement string by
doubling it (`$$` is the literal-dollar escape), applied *after* XML escaping:

```ts
/** Escape for the replacement-string position of String.prototype.replace ($ is special there). */
function replEsc(s: string): string {
  return s.replace(/\$/g, "$$$$"); // each $ → $$ (literal dollar in a replacement string)
}

// value cell:
const newValTag = originalValTag.replace(
  /(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/,
  `$1${replEsc(xmlEsc(value))}$2`,
);
return row.replace(originalValTag, replEsc(newValTag)); // newValTag still contains the $1/$2-expanded text; re-escape

// rels:
rels = rels.replace(
  "</Relationships>",
  `<Relationship ... Target="${replEsc(xmlEsc(f.careCompareUrl))}" .../></Relationships>`,
);

// footer:
xml = xml.replace("<w:sectPr>", replEsc(footerP) + "<w:sectPr>");
```

Prefer the function-replacement form to sidestep the hazard entirely — pass a callback so the
replacement is never parsed for `$`:
```ts
const newValTag = originalValTag.replace(
  /(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/,
  (_m, open, close) => `${open}${xmlEsc(value)}${close}`,
);
return row.replace(originalValTag, () => newValTag);
```
Add a regression test that fills a manual field containing `$&`, `$1`, and `$$`, then asserts
the output parses as well-formed XML and the literal `$`-text survives intact.

## Warnings

### WR-01: Manual free-text and CCN fields have no length bound — unbounded export-body cost and DoS surface

**File:** `medelite-report/src/lib/report/view-model.ts:130-137`, `:80` (ccn)

**Issue:** `emr`, `typeOfPatient`, `medicalCoverage`, `previousProviderPerformance`,
`nameOverride`, and `ccn` are validated as bare `z.string()` with no `.max()`. The full
ReportViewModel is POSTed by the client to `/api/export/docx`, so the body is entirely
client-controlled. A multi-megabyte string in any field is accepted, embedded into the document
XML, and zipped server-side. There is no request-size guard in the route. The existing
`< 4.5 MB` test only checks the *fixture* output, not an adversarial body.

**Fix:** Add `.max(...)` bounds to the manual string fields and the CCN in `ReportViewModelSchema`
(e.g. `z.string().max(200)` for short fields, a higher cap for `previousProviderPerformance`),
and/or enforce a maximum request body size in the route. Over-long input then yields the existing
clean 400 envelope instead of a large allocation.

### WR-02: Value-cell fill silently mis-fills any row whose label or value spans multiple `<w:t>` runs

**File:** `medelite-report/src/lib/docx/ReportDocx.ts:151-166`

**Issue:** The fill loop matches a row only when it contains **exactly two** `<w:t>` tags
(`tMatches.length !== 2 → return row`). Word routinely splits a single visible string across
multiple runs (rsid boundaries, spellcheck, mixed formatting). I confirmed a row whose label is
split as `<w:t>Name of </w:t>...<w:t>Facility</w:t>` yields a t-tag count of 3, so that row is
skipped and **its value is never filled** — silently leaving the original placeholder (or, if the
template stores the value placeholder split across runs, the value lands in the wrong run). This
works today only because the specific committed template happens to use single-run cells; it is a
latent correctness trap if the template is ever re-saved from Word.

**Fix:** Don't gate on a raw `<w:t>` count. Parse by cell (`<w:tc>`): take the concatenated text of
the first cell as the label, and replace the text content of the second cell as a whole (clearing
extra runs). At minimum, add a build-time assertion that every expected label in `MAP` was actually
matched and filled, so a template change fails loudly instead of silently dropping rows.

### WR-03: `formatBeds` emits locale-grouped digits into the document (non-deterministic across runtimes)

**File:** `medelite-report/src/lib/report/format.ts:28-31` (consumed at `ReportDocx.ts:85`)

**Issue:** `formatBeds` uses `value.toLocaleString()` with no locale or grouping argument. On a
server whose default locale groups with a non-ASCII separator (e.g. a narrow no-break space, or
`.` vs `,`), the rendered "Census Capacity" differs between the docx, the PDF, and the web preview
depending on the runtime's `Intl` default — breaking the "all three outputs stay consistent"
invariant and producing surprising characters in the OOXML. The output is environment-dependent.

**Fix:** Pin the locale and separator explicitly, e.g.
`value.toLocaleString("en-US")` (or format the grouping manually), so the three render targets
agree byte-for-byte regardless of server locale.

### WR-04: `formatDate` parses `processingDate` with `new Date(string)` — silent "Invalid Date" on unexpected formats

**File:** `medelite-report/src/lib/report/format.ts:70-77` (consumed at `ReportDocx.ts:184`, `ReportPDF.tsx:280`)

**Issue:** `processingDate` is validated only as `z.string()` — any string passes. `formatDate`
does `new Date(value)` and `toLocaleDateString`; for a non-date string this yields the literal
text `"Invalid Date"`, which is then embedded verbatim into the docx footer and PDF with no
indication of a problem. There is no guard or fallback.

**Fix:** Validate `processingDate` as an ISO date in the schema (e.g. `z.string().date()` or a
refine), or have `formatDate` detect `Number.isNaN(d.getTime())` and return a safe placeholder
(matching the `"N/A"` discipline used elsewhere) instead of `"Invalid Date"`.

## Info

### IN-01: Duplicated `renderMetricValue` across three render targets

**File:** `medelite-report/src/lib/docx/ReportDocx.ts:68-71`, `src/components/ReportPreview.tsx:61-64`, `src/components/pdf/ReportPDF.tsx:66-69`

**Issue:** The identical `renderMetricValue` function (null → `formatFootnote`, percent →
`formatPercent`, else `formatRate`) is copy-pasted into all three render targets. Since the stated
architecture goal is that the docx, PDF, and web preview stay consistent, three independent copies
invite drift — a future edit to one path silently diverges the outputs.

**Fix:** Extract a single shared `renderMetricValue(m: HospMetric): string` (e.g. into
`@/lib/report/format` or a small `metric-value.ts`) and import it in all three.

### IN-02: `ExportControls` hardcodes the format list in two places (toggle vs. fetch)

**File:** `medelite-report/src/components/ExportControls.tsx:32`, `:62`, `:100`

**Issue:** `Format = "pdf" | "docx"` and the toggle array `["pdf", "docx"]` and the fetch URL
`/api/export/${format}` are independent literals. Adding a third format (e.g. `.csv`) requires
edits in multiple spots with no compile-time guarantee they stay in sync. Minor maintainability
smell; not a correctness issue today.

**Fix:** Drive the toggle from a single `const FORMATS = ["pdf", "docx"] as const` and derive the
`Format` type from it (`type Format = (typeof FORMATS)[number]`).

### IN-03: Footer hyperlink color/underline is hardcoded inline rather than reusing the PDF's style constants

**File:** `medelite-report/src/lib/docx/ReportDocx.ts:180-184`

**Issue:** The injected footer hyperlink color (`1d4ed8`) and the muted date color (`9ca3af`) are
hand-written hex strings that happen to match `ReportPDF.tsx`'s `linkText`/`footerText` colors
(`#1d4ed8`, `#9ca3af`). They are unsynchronized magic values; a future PDF restyle won't carry to
the docx. Cosmetic only.

**Fix:** Hoist the two colors to a shared constant consumed by both the PDF styles and the docx
footer string so the three outputs stay visually aligned.

---

_Reviewed: 2026-06-20T09:50:21Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
