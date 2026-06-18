# Phase 4: PDF Export - Pattern Map

**Mapped:** 2026-06-18
**Files analyzed:** 6 new/modified files
**Analogs found:** 6 / 6

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/components/pdf/ReportPDF.tsx` (+ sub-components) | component | request-response | `src/components/ReportPreview.tsx` | role-match (same content, different render target) |
| `src/lib/report/slug.ts` | utility | transform | `src/lib/ui/ccn.ts` | exact (pure string transform, export style) |
| `src/components/DownloadPdfButton.tsx` | component | request-response | `src/components/CCNSearchBar.tsx` | role-match (client component with loading state + inline error) |
| `src/app/api/export/pdf/route.ts` (modify) | route | request-response | `src/app/api/export/pdf/route.ts` (self) | exact (in-place swap, preserve error envelope) |
| `tests/lib/slug.test.ts` (new) | test | transform | `tests/lib/ccn-precheck.test.ts` | exact (pure-helper test file structure) |
| `tests/api/export-pdf.test.ts` (extend) | test | request-response | `tests/api/export-pdf.test.ts` (self) | exact (add new `describe` block to existing file) |

---

## Pattern Assignments

### `src/components/pdf/ReportPDF.tsx` (component, react-pdf document)

**Analog:** `src/components/ReportPreview.tsx`

**Imports pattern** — ReportPreview.tsx lines 38–44 (replicate these imports; swap Tailwind components for react-pdf primitives):
```typescript
// WEB (analog):
import { formatRating, formatBeds, formatLocation, formatDate } from "@/lib/report/format";
import type { ReportViewModel } from "@/lib/report/view-model";

// PDF (what to write — add react-pdf imports, keep same format + view-model imports):
import { Document, Page, View, Text, Link, StyleSheet } from "@react-pdf/renderer";
import { formatRating, formatBeds, formatLocation, formatDate } from "@/lib/report/format";
import type { ReportViewModel } from "@/lib/report/view-model";
```

**NO "use client" directive** — this file is server-only; adding `"use client"` causes `next build` to fail (PITFALLS #4).

**File-top comment convention** — ReportPreview.tsx lines 1–37 show the established pattern: multi-line comment block documenting design constraints and decisions, before imports. ReportPDF.tsx must document rule #2, D-01, D-03, and the "NO grid" constraint in the same style.

**Header section pattern** — ReportPreview.tsx lines 103–113 (translate `<header className="border-b pb-4 text-center ...">` to flexbox View):
```tsx
// WEB (analog from ReportPreview.tsx lines 103-113):
<header className="border-b pb-4 text-center space-y-1">
  <p className="text-base font-bold tracking-widest uppercase text-zinc-900">
    {vm.header.platformLine}
  </p>
  <p className="text-xs font-semibold tracking-widest uppercase text-zinc-600">
    {vm.header.reportTitle}
  </p>
  <p className="text-xs tracking-widest font-medium text-zinc-500">
    {vm.header.stateLine}
  </p>
</header>

// PDF equivalent (react-pdf flexbox, NO grid, built-in Helvetica):
<View style={styles.header}>
  <Text style={styles.platformLine}>{vm.header.platformLine}</Text>
  <Text style={styles.reportTitle}>{vm.header.reportTitle}</Text>
  <Text style={styles.stateLine}>{vm.header.stateLine}</Text>
</View>
```

**Rule #2 enforcement** — NEVER pass `vm.facility.displayName` to `PdfHeader`/the header `<View>`. The header receives only `vm.header` (the three static strings). Source: ReportPreview.tsx lines 98–102 comment block + header.ts lines 1–10.

**Body field order** — ReportPreview.tsx lines 119–194 define the EXACT 13-field order with verbatim labels. The PDF must replicate this order 1:1 (D-01/D-03). Translated to flexbox rows:
```tsx
// WEB (analog from ReportPreview.tsx lines 118-194):
<dl className="grid grid-cols-[1fr_1.5fr] gap-x-4 gap-y-2">
  <dt className="font-semibold text-zinc-700">Name of Facility</dt>
  <dd className="text-zinc-900">{vm.facility.displayName}</dd>
  ...
</dl>

// PDF equivalent — one <View> per row, flexDirection: 'row':
<View style={styles.row}>
  <Text style={styles.label}>Name of Facility</Text>
  <Text style={styles.value}>{vm.facility.displayName}</Text>
</View>
```

**Verbatim labels** (from ReportPreview.tsx lines 119–193 — copy exactly):
1. `"Name of Facility"` → `vm.facility.displayName`
2. `"Location"` → `formatLocation(vm.facility.address)`
3. `"EMR"` → `vm.manual.emr ?? "—"`
4. `"Census Capacity"` → `formatBeds(vm.facility.certifiedBeds)`
5. `"Current Census"` → `vm.manual.currentCensus != null ? String(vm.manual.currentCensus) : "—"`
6. `"Type of Patient"` → `vm.manual.typeOfPatient ?? "—"`
7. `"Previous Coverage from Medelite"` → `vm.manual.previousCoverage ?? "—"`
8. `"Previous Provider Performance from Medelite"` → `vm.manual.previousProviderPerformance ?? "—"`
9. `"Medical Coverage"` → `vm.manual.medicalCoverage ?? "—"`
10. `"Overall Star Rating"` → `formatRating(vm.facility.starRatings.overall)`
11. `"Health Inspection"` → `formatRating(vm.facility.starRatings.healthInspection)`
12. `"Staffing"` → `formatRating(vm.facility.starRatings.staffing)`
13. `"Quality of Resident Care"` → `formatRating(vm.facility.starRatings.qualityCare)`

**Null/zero handling** — formatters use `=== null` (not falsiness). From format.ts lines 19–22:
```typescript
export function formatRating(value: number | null): string {
  if (value === null) return PLACEHOLDER;  // "N/A"
  return String(value);
}
// Real 0 → "0"; never use || or ! for fallback (D-10 / format.ts lines 3–8 comment)
```

**Footer pattern** — ReportPreview.tsx lines 197–199:
```tsx
// WEB (analog):
<footer className="border-t pt-3 text-xs text-zinc-400 text-right">
  CMS processing date: {formatDate(vm.facility.processingDate)}
</footer>

// PDF equivalent:
<View style={styles.footer}>
  <Text style={styles.footerText}>
    CMS processing date: {formatDate(vm.facility.processingDate)}
  </Text>
</View>
```

**Medicare link pattern** (D-04) — use `vm.facility.careCompareUrl` directly (already validated):
```tsx
<Link src={vm.facility.careCompareUrl}>
  <Text style={styles.linkText}>View official CMS profile on Medicare.gov</Text>
</Link>
// Use src prop (not href). Blue + underlined styling in StyleSheet.
```

**StyleSheet.create pattern** — no Tailwind, use react-pdf StyleSheet:
```typescript
const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10 },
  header: {
    borderBottomWidth: 1, borderBottomColor: "#e5e7eb",
    marginBottom: 12, paddingBottom: 8, alignItems: "center",
  },
  platformLine: { fontFamily: "Helvetica-Bold", fontSize: 12, letterSpacing: 2 },
  reportTitle: { fontFamily: "Helvetica-Bold", fontSize: 9, letterSpacing: 1, color: "#52525b" },
  stateLine: { fontSize: 9, color: "#71717a" },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: "45%", fontFamily: "Helvetica-Bold", fontSize: 10, color: "#374151" },
  value: { flex: 1, fontFamily: "Helvetica", fontSize: 10, color: "#18181b" },
  footer: { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 12, paddingTop: 6 },
  footerText: { fontSize: 9, color: "#a1a1aa", textAlign: "right" },
  linkText: { fontSize: 9, color: "#1d4ed8", textDecoration: "underline" },
});
```

**Page format** — `<Page size="LETTER">` (US Letter 612×792pt, D-02). No `Font.register` (D-03).

**Export style** — Named export matching the codebase convention (all existing components use named exports):
```typescript
export function ReportPDF({ vm }: { vm: ReportViewModel }) {
  return (
    <Document title={vm.facility.displayName}>
      <Page size="LETTER" style={styles.page}>
        ...
      </Page>
    </Document>
  );
}
```

---

### `src/lib/report/slug.ts` (utility, transform)

**Analog:** `src/lib/ui/ccn.ts`

**Imports pattern** — ccn.ts lines 1–11: pure lib module, NO `"use client"` directive, module-level const for the core logic, inline comment block at top:
```typescript
// ccn.ts structure to replicate:
// [module-level comment block referencing relevant decisions]
// const CCN_REGEX = /^[A-Za-z0-9]{6}$/;
// export function normalizeCcn(...) { ... }
// export function isValidCcnFormat(...) { ... }
```

**File-top comment** — ccn.ts lines 1–10 show the pattern: reference the decision IDs and the behavior:
```typescript
// slug.ts — Pure filename slug helper for PDF export (D-06).
//
// slugFilename(displayName, ccn) → "<slug>-Snapshot.pdf"
// Fallback: when displayName is blank/whitespace or the slug empties out, use "<ccn>-Snapshot.pdf".
// Edge cases: blank input, all-special-chars, normal name, CCN with leading zeros.
```

**Core function signature** — pure, exported, matches format.ts/ccn.ts convention:
```typescript
export function slugFilename(displayName: string, ccn: string): string {
  const slug = displayName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")   // non-alphanumeric → hyphen
    .replace(/^-+|-+$/g, "");       // trim leading/trailing hyphens
  if (!slug) return `${ccn}-Snapshot.pdf`;
  return `${slug}-Snapshot.pdf`;
}
```

**Export style** — named export (ccn.ts line 24: `export function normalizeCcn`); no default export in this codebase.

**No imports needed** — this is a pure string function; no external deps (mirrors ccn.ts which has no imports other than no-import pure functions).

**TypeScript isolatedModules** — every `.ts` file must have at least one `import` or `export`. The function export satisfies this.

---

### `src/components/DownloadPdfButton.tsx` (component, client, request-response)

**Analog:** `src/components/CCNSearchBar.tsx`

**"use client" directive** — CCNSearchBar.tsx line 1: `"use client";` — required; the button uses `useState` and browser APIs (`fetch`, `URL.createObjectURL`).

**Imports pattern** — CCNSearchBar.tsx lines 19–22 (import only safe client-side modules; NEVER import `@react-pdf/renderer`):
```typescript
"use client";

import { useState } from "react";
import type { ReportViewModel } from "@/lib/report/view-model";
// NO import from @react-pdf/renderer — server-only (T-03-09 / PITFALLS #4)
// NO import of ReportPDF component — same reason
```

**Props interface pattern** — CCNSearchBar.tsx lines 24–40 (typed props with JSDoc):
```typescript
interface Props {
  /** The assembled view-model to export. Null when no successful fetch exists. */
  vm: ReportViewModel | null;
}
```

**State pattern** — CCNSearchBar.tsx lines 59–61 (`useState` for async loading state):
```typescript
// CCNSearchBar analog:
const [localError, setLocalError] = useState<string | null>(null);
// loading comes as a prop there; for DownloadPdfButton, loading is local state:
const [loading, setLoading] = useState(false);
const [exportError, setExportError] = useState<string | null>(null);
```

**Disabled state** — CCNSearchBar.tsx lines 115–117 (disabled prop + visual feedback):
```tsx
// CCNSearchBar (analog):
<button type="submit" disabled={loading} className={[
  "rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors",
  loading ? "cursor-not-allowed bg-blue-300" : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
].join(" ")}>
  {loading ? "Loading…" : "Generate"}
</button>

// DownloadPdfButton equivalent:
<button
  type="button"
  disabled={loading || !vm}  // D-07: disabled when loading OR no vm
  onClick={handleDownload}
  className={[...].join(" ")}
>
  {loading ? "Generating…" : "Download PDF"}
</button>
```

**Inline error pattern** — CCNSearchBar.tsx lines 129–132 (local `<p role="alert">` BELOW the button; NOT the top ErrorBanner — D-08):
```tsx
// CCNSearchBar analog (inline error beneath the form element):
{displayedError && (
  <p id={errorId} role="alert" className="text-sm text-red-600 mt-1">
    {displayedError}
  </p>
)}

// DownloadPdfButton (same pattern — inline error beside/below button, NOT ErrorBanner):
{exportError && (
  <p role="alert" className="text-sm text-red-600 mt-1">
    {exportError}
  </p>
)}
```

**Do NOT use `ErrorBanner`** — ErrorBanner.tsx is for CMS lookup errors (top-of-page, system-level). Export errors stay local (D-08): inline `<p role="alert">` below the button only.

**Fetch → blob → anchor pattern** (D-05):
```typescript
async function handleDownload(): Promise<void> {
  if (!vm) return;
  setLoading(true);
  setExportError(null);
  try {
    const resp = await fetch("/api/export/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vm),
    });
    if (!resp.ok) {
      throw new Error("PDF generation failed");
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "report.pdf"; // fallback; Content-Disposition controls real filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    setExportError("Couldn't generate PDF — try again.");
    // D-08: keep button enabled for retry (don't set loading=true after error)
  } finally {
    setLoading(false);
  }
}
```

**Placement in SnapshotApp** — SnapshotApp.tsx lines 134–167: the left pane (`<div className="flex-1 flex flex-col gap-4 max-w-sm">`). The button is added below `<ManualInputsForm>`, reading `vm` from state (already assembled, line 119–121):
```tsx
// SnapshotApp.tsx — add after ManualInputsForm:
<DownloadPdfButton vm={vm} />
```

**Export style** — named export (all codebase components use named exports):
```typescript
export function DownloadPdfButton({ vm }: Props) { ... }
```

---

### `src/app/api/export/pdf/route.ts` (modify — route, request-response)

**Analog:** self (in-place swap)

**Keep unchanged** (route.ts lines 1–52 — do not touch):
- `export const runtime = "nodejs"` (line 13)
- `import { ReportViewModelSchema } from "@/lib/report/view-model"` (line 10)
- The entire `try { body = await request.json() } catch { return 400 }` block (lines 24–37)
- The `safeParse` + 400 invalid_request branch (lines 38–52) — exact error envelope preserved
- Comment convention at top (lines 1–9)

**New imports to add** (before the existing import):
```typescript
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPDF } from "@/components/pdf/ReportPDF";
import { slugFilename } from "@/lib/report/slug";
```

**Replace the 501 stub** (route.ts lines 54–66) with:
```typescript
// Phase 4: renderToBuffer + Content-Disposition filename (D-09 / D-06)
const pdfBuffer = await renderToBuffer(<ReportPDF vm={parseResult.data} />);
const filename = slugFilename(
  parseResult.data.facility.displayName,
  parseResult.data.facility.ccn,
);
return new Response(pdfBuffer, {
  status: 200,
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```

**Response style** — use `new Response(...)` directly (NOT `NextResponse`) for binary responses. The existing stub already uses `Response.json(...)` (not `NextResponse`) — maintain that pattern.

**Error envelope discipline** — route.ts lines 42–52 shows the exact envelope to keep:
```typescript
return Response.json(
  { error: { kind: "invalid_request", message: "Invalid report data." } },
  { status: 400 },
);
// No Zod internals (issues, paths, codes) in the 400 body — D-05/D-21.
```

---

### `tests/lib/slug.test.ts` (new test file, unit test for pure helper)

**Analog:** `tests/lib/ccn-precheck.test.ts`

**Imports pattern** — ccn-precheck.test.ts lines 9–10:
```typescript
import { describe, expect, it } from "vitest";
import { slugFilename } from "@/lib/report/slug";
```

**File-top comment** — ccn-precheck.test.ts lines 1–7 (explain the function under test + relevant decisions):
```typescript
// slug.test.ts — unit tests for the filename slug helper (D-06).
//
// slugFilename(displayName, ccn) → "<slug>-Snapshot.pdf"
// Edge cases: blank → CCN fallback; all-special-chars → CCN fallback;
//   normal name → slug; CCN with leading zeros preserved.
```

**Test structure** — ccn-precheck.test.ts lines 11–40 (one `describe` block per function, `it` per case with decision ref in name):
```typescript
describe("slugFilename", () => {
  it("D-06: blank displayName returns '<ccn>-Snapshot.pdf'", () => {
    expect(slugFilename("", "686123")).toBe("686123-Snapshot.pdf");
  });
  it("D-06: whitespace-only displayName returns '<ccn>-Snapshot.pdf'", () => {
    expect(slugFilename("   ", "686123")).toBe("686123-Snapshot.pdf");
  });
  it("D-06: all-special-chars displayName returns '<ccn>-Snapshot.pdf'", () => {
    expect(slugFilename("---///", "686123")).toBe("686123-Snapshot.pdf");
  });
  it("D-06: normal name slugifies correctly", () => {
    expect(slugFilename("Kendall Lakes Healthcare and Rehab Center", "686123"))
      .toBe("kendall-lakes-healthcare-and-rehab-center-Snapshot.pdf");
  });
  it("D-06: CCN with leading zeros is preserved as-is in fallback", () => {
    expect(slugFilename("", "012345")).toBe("012345-Snapshot.pdf");
  });
});
```

**Fixture usage** — ccn-precheck.test.ts uses no fixture (pure string inputs). The slug test similarly needs no fixture.

---

### `tests/api/export-pdf.test.ts` (extend — add new describe block)

**Analog:** self (existing file, extend only)

**Keep existing describes** — tests/api/export-pdf.test.ts lines 30–97 (`describe("POST /api/export/pdf — invalid body")` and `describe("POST /api/export/pdf — valid ReportViewModel body")`). The 9 existing tests must remain green; Phase 4 adds a new `describe` block after them.

**Test structure** — export-pdf.test.ts lines 1–28 (existing imports + helpers to reuse):
```typescript
// Existing imports — reuse all of them; add no new imports beyond what's needed:
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/pdf/route";
import { assembleViewModel } from "@/lib/report/view-model";
import { toFacilityData } from "@/lib/cms/mapper";
import { parseCMSRow } from "@/lib/cms/parse";
import providerFixture from "../fixtures/provider-686123.json";
// Reuse the existing `validVm` and `makeRequest` helpers (lines 13-28).
```

**New describe block to add** (after line 97):
```typescript
describe("POST /api/export/pdf — Phase 4: real PDF response (D-09 / SC#5)", () => {
  it("returns 200 for a valid ReportViewModel", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.status).toBe(200);
  });

  it("SC#5: Content-Type is application/pdf", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.headers.get("content-type")).toContain("application/pdf");
  });

  it("SC#5: Content-Disposition is attachment", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.headers.get("content-disposition")).toContain("attachment");
  });

  it("SC#5: Content-Disposition filename contains a slug of the facility name", async () => {
    const resp = await POST(makeRequest(validVm));
    const cd = resp.headers.get("content-disposition") ?? "";
    // Kendall Lakes → "kendall-lakes-..."
    expect(cd).toContain("kendall-lakes");
  });

  it("SC#5: Medicare URL appears in the PDF buffer (D-04 / PDF-02)", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    const url = "https://www.medicare.gov/care-compare/details/nursing-home/686123";
    expect(buf.toString("latin1")).toContain(url);
  });

  it("SC#2: static header strings appear in the PDF buffer (CLAUDE.md rule #2)", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    const latin1 = buf.toString("latin1");
    expect(latin1).toContain("INFINITE");
    expect(latin1).toContain("FACILITY ASSESSMENT SNAPSHOT");
    expect(latin1).toContain("FL");
  });

  it("rule #2: facility name does not appear adjacent to the static header strings", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    const latin1 = buf.toString("latin1");
    // The header platformLine must be present:
    expect(latin1).toContain("INFINITE");
    // Facility name appears in the PDF body but must NOT be part of the header platformLine:
    // (belt-and-suspenders — the component structure enforces this)
    expect(latin1).toContain("KENDALL LAKES");  // present in body
  });
});
```

**Buffer assertion method** — `buf.toString("latin1").includes(url)` is the verified approach (RESEARCH.md "High-Value Unknown Resolutions #2"). Use `Buffer.from(await resp.arrayBuffer())` to convert the Response body to a Node.js Buffer in Vitest node env.

---

## Shared Patterns

### No "use client" on server/lib files
**Source:** `src/lib/ui/ccn.ts` (no directive), `src/lib/report/format.ts` (no directive)
**Apply to:** `src/lib/report/slug.ts`, `src/components/pdf/ReportPDF.tsx`
Pure lib modules and server components never carry `"use client"`. Only interactive components with state/browser APIs carry the directive.

### "use client" on interactive components
**Source:** `src/components/CCNSearchBar.tsx` line 1, `src/components/SnapshotApp.tsx` line 1
**Apply to:** `src/components/DownloadPdfButton.tsx`
```typescript
"use client";
// [multi-line comment block explaining security constraints and behavior]
import { useState } from "react";
```

### Named exports (never default exports)
**Source:** Every component and lib file in the codebase
**Apply to:** All Phase 4 new files
```typescript
export function ReportPDF(...) { ... }
export function DownloadPdfButton(...) { ... }
export function slugFilename(...) { ... }
```

### Error envelope discipline (no Zod internals)
**Source:** `src/app/api/export/pdf/route.ts` lines 42–52
**Apply to:** The modified route.ts — preserve the existing 400 envelope exactly
```typescript
return Response.json(
  { error: { kind: "invalid_request", message: "Invalid report data." } },
  { status: 400 },
);
// Object.keys(body) === ["error"]
// Object.keys(body.error) === ["kind", "message"]
```

### Formatter null-safety (=== null, never ||/!)
**Source:** `src/lib/report/format.ts` lines 19–22
**Apply to:** `src/components/pdf/ReportPDF.tsx` — all number | null fields
```typescript
if (value === null) return PLACEHOLDER;  // "N/A"
return String(value);
// NEVER: value || "N/A"  (collapses real 0 to N/A — D-10 footgun)
```

### Inline error — local `<p role="alert">`, not ErrorBanner
**Source:** `src/components/CCNSearchBar.tsx` lines 129–132
**Apply to:** `src/components/DownloadPdfButton.tsx` (D-08)
```tsx
{displayedError && (
  <p id={errorId} role="alert" className="text-sm text-red-600 mt-1">
    {displayedError}
  </p>
)}
// ErrorBanner is for CMS lookup errors only. Export errors live next to the button.
```

### Vitest test structure — describe + it with decision refs
**Source:** `tests/lib/ccn-precheck.test.ts` lines 11–40, `tests/lib/report/format.test.ts` lines 17–37
**Apply to:** `tests/lib/slug.test.ts`, new describe block in `tests/api/export-pdf.test.ts`
```typescript
describe("functionName", () => {
  it("D-XX: describes the exact behavior and decision reference", () => {
    expect(fn(input)).toBe(expected);
  });
});
```

### Fixed test date (determinism)
**Source:** `tests/api/export-pdf.test.ts` line 13, `tests/lib/report/view-model.test.ts` line 17
**Apply to:** Extended `tests/api/export-pdf.test.ts` (reuse existing `FIXED_DATE` and `validVm`)
```typescript
const FIXED_DATE = "2026-06-17T12:00:00Z";
const validVm = assembleViewModel(toFacilityData(parseCMSRow(providerFixture[0])), {}, FIXED_DATE);
// validVm is already defined in the file — reuse it in the new describe block.
```

---

## No Analog Found

No files in Phase 4 lack an analog. All six files have strong codebase matches.

---

## Metadata

**Analog search scope:** `src/components/`, `src/lib/`, `src/app/api/`, `tests/`
**Files scanned:** 14 source files, 14 test files
**Pattern extraction date:** 2026-06-18
