# Phase 6: .docx Export - Pattern Map

**Mapped:** 2026-06-19
**Files analyzed:** 7 (5 new + 2 modified)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/lib/docx/ReportDocx.ts` | service (document builder) | transform | `src/components/pdf/ReportPDF.tsx` | exact (same content, same field order, different library) |
| `src/app/api/export/docx/route.ts` | route handler | request-response | `src/app/api/export/pdf/route.tsx` | exact (validate → buffer → headers, same contract) |
| `src/components/ExportControls.tsx` | component (client) | request-response | `src/components/DownloadPdfButton.tsx` | exact (lift all download/blob/error logic; add format toggle) |
| `tests/api/export-docx.test.ts` | test | request-response | `tests/api/export-pdf.test.ts` | exact (same request construction, same status/header/buffer assertions) |
| `src/lib/report/slug.ts` (modify) | utility | transform | self | self (add `ext` default param; no logic change) |
| `tests/lib/slug.test.ts` (modify) | test | transform | self | self (extend existing assertions; do not weaken) |
| `src/components/SnapshotApp.tsx` (modify) | component (client) | request-response | self | self (swap one import + one JSX element) |

---

## Pattern Assignments

### `src/lib/docx/ReportDocx.ts` (service, transform)

**Analog:** `src/components/pdf/ReportPDF.tsx`

**Imports pattern** (`ReportPDF.tsx` lines 34–58 — mirror every import, swap library):
```typescript
// ReportPDF.tsx imports (lines 34-58) — replace @react-pdf/renderer with docx primitives
import {
  formatRating,
  formatBeds,
  formatLocation,
  formatDate,
  formatPercent,
  formatRate,
  formatFootnote,
} from "@/lib/report/format";
import {
  INFINITE_LOGO_DATA_URI,
  INFINITE_LOGO_WIDTH,
  INFINITE_LOGO_HEIGHT,
} from "@/lib/report/logo";
import type { ReportViewModel } from "@/lib/report/view-model";
import type { HospMetric } from "@/lib/cms/types";
```

For `ReportDocx.ts`, the `docx` imports replace `@react-pdf/renderer` (verified against `node_modules/docx/dist/index.d.ts`):
```typescript
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, ExternalHyperlink, AlignmentType, WidthType, BorderStyle,
  PageOrientation,
} from "docx";
// All other @/lib/report/* imports are identical to ReportPDF.tsx
```

**Static header pattern** (`ReportPDF.tsx` lines 203–209 — rule #2 static branding, no facility name):
```tsx
{/* HEADER — INFINITE logo (rule #2 static branding) + title + state */}
<View style={styles.header}>
  <Image style={styles.logo} src={INFINITE_LOGO_DATA_URI} />
  <Text style={styles.reportTitle}>{vm.header.reportTitle}</Text>
  <Text style={styles.stateLine}>{vm.header.stateLine}</Text>
</View>
```

The `docx` twin uses `vm.header.reportTitle` and `vm.header.stateLine` identically — never `f.displayName` in the header. Logo decoded from base64 data-URI:
```typescript
const b64 = INFINITE_LOGO_DATA_URI.replace(/^data:image\/png;base64,/, "");
const LOGO_BUFFER = Buffer.from(b64, "base64");
// ImageRun requires EMU not pixels — multiply by 9144 at 96 DPI
new ImageRun({ type: "png", data: LOGO_BUFFER, transformation: { width: LOGO_DISPLAY_W_EMU, height: LOGO_DISPLAY_H_EMU } })
// Critical: `type` is REQUIRED in v9 (RegularImageOptions line 2621 of index.d.ts)
// Critical: dimensions in EMU — never raw pixels (2 inches = 1_828_800 EMU)
```

**renderMetricValue helper** (`ReportPDF.tsx` lines 66–69 — copy verbatim):
```typescript
function renderMetricValue(m: HospMetric): string {
  if (m.value === null) return formatFootnote(m.footnoteCode);
  return m.unit === "percent" ? formatPercent(m.value) : formatRate(m.value);
}
```

**13-field body table** (`ReportPDF.tsx` lines 213–246 — copy labels/order/values exactly):
```tsx
<PdfRow label="Name of Facility" value={f.displayName} />
<PdfRow label="Location" value={formatLocation(f.address)} />
<PdfRow label="EMR" value={m.emr ?? "—"} />
<PdfRow label="Census Capacity" value={formatBeds(f.certifiedBeds)} />
<PdfRow label="Current Census" value={m.currentCensus != null ? String(m.currentCensus) : "—"} />
<PdfRow label="Type of Patient" value={m.typeOfPatient ?? "—"} />
<PdfRow label="Previous Coverage from Medelite" value={m.previousCoverage ?? "—"} />
<PdfRow label="Previous Provider Performance from Medelite" value={m.previousProviderPerformance ?? "—"} />
<PdfRow label="Medical Coverage" value={m.medicalCoverage ?? "—"} />
<PdfRow label="Overall Star Rating" value={formatRating(f.starRatings.overall)} />
<PdfRow label="Health Inspection" value={formatRating(f.starRatings.healthInspection)} />
<PdfRow label="Staffing" value={formatRating(f.starRatings.staffing)} />
<PdfRow label="Quality of Resident Care" value={formatRating(f.starRatings.qualityCare)} />
```
Note: the em dash `"—"` is the exact fallback for missing manual fields (`ReportPDF.tsx` lines 217–231).

**D-09 degraded line** (`ReportPDF.tsx` lines 252–268 — the `vm.hospMetrics === undefined` branch):
```tsx
{vm.hospMetrics === undefined ? (
  <View style={styles.row}>
    <View style={styles.fullCell}>
      <Text style={styles.degradedText}>
        Hospitalization &amp; ED metrics are temporarily unavailable.
      </Text>
    </View>
  </View>
) : (
  vm.hospMetrics.map((metric, i) => (
    <PdfRow key={i} label={metric.label} value={renderMetricValue(metric)} />
  ))
)}
```

In `docx`, the degraded line is a full `columnSpan: 2` `TableCell`. The metric label text must use `metric.label` (verbatim garbled labels from Phase 5, D-04 — e.g. `"STR State National Avg. for Hospitalization"`). Do not sanitize or alter these labels.

**Footer hyperlink** (`ReportPDF.tsx` lines 271–282):
```tsx
{/* FOOTER — required clickable Medicare link (rule #7) + CMS processing date */}
<Link src={f.careCompareUrl}>
  <Text style={styles.linkText}>
    View official CMS profile on Medicare.gov
  </Text>
</Link>
<Text style={styles.footerText}>
  CMS processing date: {formatDate(f.processingDate)}
</Text>
```

The `docx` twin uses `ExternalHyperlink` with `link` (NOT `href`) and `style: "Hyperlink"`. The label text `"View official CMS profile on Medicare.gov"` is verbatim. The CMS date uses the same `formatDate(f.processingDate)` call.

**Document title** (`ReportPDF.tsx` line 201):
```tsx
<Document title={f.displayName}>
```
In `docx`: `new Document({ title: f.displayName, sections: [...] })` — D-11.

**Server-only discipline** (`ReportPDF.tsx` line 1 comment, PITFALLS #4):
```
// NO "use client" — this file is server-only (PITFALLS #4: @react-pdf/renderer must not
//   reach the client bundle; `next build` fails if it does).
```
`ReportDocx.ts` carries the same discipline: no `"use client"` directive, no export that reaches a client component, imported only by the route handler.

---

### `src/app/api/export/docx/route.ts` (route handler, request-response)

**Analog:** `src/app/api/export/pdf/route.tsx`

**Full file pattern** (`route.tsx` lines 1–77 — clone structure verbatim, change imports and render call):

**Imports** (lines 15–18):
```typescript
import { renderToBuffer } from "@react-pdf/renderer";
import { ReportPDF } from "@/components/pdf/ReportPDF";
import { slugFilename } from "@/lib/report/slug";
import { ReportViewModelSchema } from "@/lib/report/view-model";
```
Replace with:
```typescript
import { Packer } from "docx";
import { buildReportDocx } from "@/lib/docx/ReportDocx";
import { slugFilename } from "@/lib/report/slug";
import { ReportViewModelSchema } from "@/lib/report/view-model";
```

**Runtime declaration** (line 21 — copy verbatim):
```typescript
export const runtime = "nodejs";
```

**Non-JSON body guard** (lines 33–45 — copy verbatim):
```typescript
let body: unknown;
try {
  body = await request.json();
} catch {
  return Response.json(
    {
      error: {
        kind: "invalid_request",
        message: "Invalid report data.",
      },
    },
    { status: 400 },
  );
}
```

**Zod validation + 400 envelope** (lines 46–60 — copy verbatim, the clean-envelope discipline):
```typescript
const parseResult = ReportViewModelSchema.safeParse(body);

if (!parseResult.success) {
  // D-21 / D-05: return a clean error envelope — NO Zod internals (paths, issues, codes).
  return Response.json(
    {
      error: {
        kind: "invalid_request",
        message: "Invalid report data.",
      },
    },
    { status: 400 },
  );
}
```

**Buffer + Response** (lines 62–77 — same `new Uint8Array(buffer)` cast pattern, different Content-Type):
```typescript
const pdfBuffer = await renderToBuffer(<ReportPDF vm={parseResult.data} />);
const filename = slugFilename(
  parseResult.data.facility.displayName,
  parseResult.data.facility.ccn,
);
return new Response(new Uint8Array(pdfBuffer), {
  status: 200,
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```

For `docx/route.ts`, replace the buffer+response section with:
```typescript
const docxBuffer = await Packer.toBuffer(buildReportDocx(parseResult.data));
const filename = slugFilename(
  parseResult.data.facility.displayName,
  parseResult.data.facility.ccn,
  ".docx",   // D-13: ext parameter
);
return new Response(new Uint8Array(docxBuffer), {
  status: 200,
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${filename}"`,
  },
});
```

Note: the `new Uint8Array(buffer)` cast is used because `Buffer extends Uint8Array` at runtime — the existing PDF route confirms this at line 70 (`new Uint8Array(pdfBuffer)`). `Packer.toBuffer` returns `Promise<Buffer>` (verified: `index.d.ts` line 2435).

Note on `serverExternalPackages`: the existing `next.config.ts` declares `serverExternalPackages: ["@react-pdf/renderer"]`. `docx` does NOT need to be added (pure CJS, no native bindings, no Node-only ESM internals) — leave `next.config.ts` unchanged.

---

### `src/components/ExportControls.tsx` (component, request-response)

**Analog:** `src/components/DownloadPdfButton.tsx`

**"use client" directive + Props interface** (lines 1, 27–30 — carry verbatim):
```typescript
"use client";
// ...
interface Props {
  /** The assembled view-model to export. Null when no successful fetch exists. */
  vm: ReportViewModel | null;
}
```

**Import list** (lines 24–25 — carry verbatim, no new imports from docx):
```typescript
import { useState } from "react";
import type { ReportViewModel } from "@/lib/report/view-model";
// MUST NOT import docx, Packer, or buildReportDocx — server-only modules
```

**State declarations** (lines 42–43 — extend with `format` state):
```typescript
const [loading, setLoading] = useState(false);
const [exportError, setExportError] = useState<string | null>(null);
// Add for ExportControls:
type Format = "pdf" | "docx";
const [format, setFormat] = useState<Format>("pdf");   // D-03: PDF default
```

**handleDownload function** (lines 45–79 — lift entirely, adjust fetch URL for format):
```typescript
async function handleDownload(): Promise<void> {
  if (!vm) return;           // D-07 guard
  setLoading(true);
  setExportError(null);
  try {
    const resp = await fetch("/api/export/pdf", {    // ← becomes /api/export/${format}
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vm),
    });
    if (!resp.ok) {
      throw new Error("PDF generation failed");      // ← error message tracks format
    }
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "report.pdf";                       // ← "report.pdf" or "report.docx"
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 0);   // WR-02: carry verbatim
  } catch {
    setExportError("Couldn't generate PDF — try again."); // ← tracks format
  } finally {
    setLoading(false);
  }
}
```

**Button disabled logic** (line 87 — carry verbatim):
```tsx
disabled={loading || !vm}
```

**Button label pattern** (line 94 — generalize):
```tsx
{loading ? "Generating…" : "Download PDF"}
// In ExportControls: {loading ? "Generating…" : `Download ${format.toUpperCase()}`}
```

**Inline error element** (lines 98–101 — carry verbatim):
```tsx
{exportError && (
  <p role="alert" className="text-sm text-red-600 mt-1">
    {exportError}
  </p>
)}
```

**New element for ExportControls** — the `PDF | DOCX` segmented toggle. Add above the button. Requirements: keyboard-operable (buttons, not divs), selected segment programmatically indicated (`aria-pressed` or `aria-current`), single format always visible:
```tsx
<div role="group" aria-label="Export format" className="flex rounded-md border border-zinc-300 overflow-hidden">
  {(["pdf", "docx"] as Format[]).map((f) => (
    <button
      key={f}
      type="button"
      onClick={() => setFormat(f)}
      aria-pressed={format === f}
      disabled={loading}
      className={[
        "px-3 py-1 text-sm font-medium transition-colors",
        format === f
          ? "bg-blue-600 text-white"
          : "bg-white text-zinc-700 hover:bg-zinc-50",
        loading ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {f.toUpperCase()}
    </button>
  ))}
</div>
```

---

### `tests/api/export-docx.test.ts` (test, request-response)

**Analog:** `tests/api/export-pdf.test.ts`

**Imports + fixture assembly** (lines 1–41 — mirror exactly, swap route import):
```typescript
import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/export/docx/route";    // ← only this import changes
import { assembleViewModel } from "@/lib/report/view-model";
import { toFacilityData } from "@/lib/cms/mapper";
import { parseCMSRow } from "@/lib/cms/parse";
import { joinClaimsAndAverages } from "@/lib/cms/claims-mapper";
import { ClaimsRowSchema } from "@/lib/cms/claims-schema";
import { AveragesRowSchema } from "@/lib/cms/averages-schema";
import providerFixture from "../fixtures/provider-686123.json";
import claimsFixture from "../fixtures/claims-686123.json";
import averagesFixture from "../fixtures/averages-xcdc.json";

const FIXED_DATE = "2026-06-17T12:00:00Z";
const parsedClaims = claimsFixture.map((row) => ClaimsRowSchema.parse(row));
const NATION = AveragesRowSchema.parse(averagesFixture.NATION);
const FL = AveragesRowSchema.parse(averagesFixture.FL);
const hospMetrics = joinClaimsAndAverages(parsedClaims, NATION, FL);

const validVm = assembleViewModel(
  toFacilityData(parseCMSRow(providerFixture[0])),
  {},
  FIXED_DATE,
);
const validVmWithMetrics = assembleViewModel(
  toFacilityData(parseCMSRow(providerFixture[0])),
  {},
  FIXED_DATE,
  hospMetrics,
);
```

**makeRequest helper** (line 83–88 — mirror, change URL):
```typescript
function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/export/docx", {  // ← URL
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}
```

**Invalid body describe block** (lines 91–138 — mirror assertion-for-assertion):
```typescript
describe("POST /api/export/docx — invalid body", () => {
  it("returns 400 for an empty object body", ...);
  it("returns kind: 'invalid_request' for a bad shape", ...);
  it("error envelope has a message string", ...);
  it("400 body does not leak Zod internals (D-05 discipline)", ...);    // checks: no /issues|expected|received|path/
  it("400 body has the exact error envelope shape (no extra fields)", ...); // keys: ["error"] + ["kind","message"]
  it("returns 400 invalid_request for a non-JSON body (not a raw 500)", ...);
});
```

**Valid body describe block** (lines 146–229 — mirror, adapt assertions for DOCX):
```typescript
describe("POST /api/export/docx — valid body", () => {
  it("returns 200 for a valid ReportViewModel", ...);

  it("Content-Type is the OOXML MIME type", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.headers.get("content-type")).toContain(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("Content-Disposition is attachment with .docx filename", async () => {
    const resp = await POST(makeRequest(validVm));
    expect(resp.headers.get("content-disposition")).toContain("attachment");
    expect(resp.headers.get("content-disposition")).toContain(".docx");
  });

  it("Content-Disposition filename contains a slug of the facility name", async () => {
    // Matches export-pdf.test.ts line 162–167 pattern
    const resp = await POST(makeRequest(validVm));
    const cd = resp.headers.get("content-disposition") ?? "";
    expect(cd).toContain("kendall-lakes");
  });

  // DOCX-01 SC#3 — size guard
  it("buffer is under 4_500_000 bytes (DOCX-01 SC#3)", async () => {
    const resp = await POST(makeRequest(validVm));
    const buf = Buffer.from(await resp.arrayBuffer());
    expect(Buffer.byteLength(buf)).toBeLessThan(4_500_000);
  });

  // ZIP magic bytes — proves it's a real OOXML file, not empty/corrupt
  it("response body is a valid OOXML ZIP (PK magic bytes 50 4B 03 04)", async () => {
    const resp = await POST(makeRequest(validVm));
    const bytes = new Uint8Array(await resp.arrayBuffer());
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4B);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
  });
});
```

The PDF test's `extractTextFromPdf` helper (lines 53–81) is PDF-specific and is NOT carried over. The DOCX equivalent structural check is the PK magic bytes assertion above.

---

### `src/lib/report/slug.ts` (modify — add `ext` default param)

**Analog:** self (no new analog; extend existing file)

**Current function signature** (line 35):
```typescript
export function slugFilename(displayName: string, ccn: string): string {
```

**Generalized signature** (D-13):
```typescript
export function slugFilename(displayName: string, ccn: string, ext = ".pdf"): string {
```

**Current hardcoded extension** (line 42):
```typescript
if (slug) return `${slug}-Snapshot.pdf`;
// ...
return `${safeCcn || "facility"}-Snapshot.pdf`;
```

**Parameterized** — replace `.pdf` with `${ext}` in both return statements:
```typescript
if (slug) return `${slug}-Snapshot${ext}`;
// ...
return `${safeCcn || "facility"}-Snapshot${ext}`;
```

All existing sanitization logic (lines 36–49) is unchanged. The `ext` parameter comes only from route handler code (never user input), so it does not need sanitization.

---

### `tests/lib/slug.test.ts` (modify — add `.docx` assertions)

**Analog:** self (add to end of existing describe block; do not weaken any existing test)

**Existing assertion style** (lines 11–58 — carry as model for new assertions):
```typescript
it("D-06: blank displayName returns '<ccn>-Snapshot.pdf'", () => {
  expect(slugFilename("", "686123")).toBe("686123-Snapshot.pdf");
});
it("D-06: normal name slugifies correctly", () => {
  expect(slugFilename("Kendall Lakes Healthcare and Rehab Center", "686123"))
    .toBe("kendall-lakes-healthcare-and-rehab-center-Snapshot.pdf");
});
```

**New assertions to add** (D-13 — default `ext = ".pdf"` must not break any existing call):
```typescript
// D-13: ext parameter — .docx extension
it("D-13: slugFilename with .docx ext returns slug-Snapshot.docx", () => {
  expect(slugFilename("Kendall Lakes Healthcare and Rehab Center", "686123", ".docx"))
    .toBe("kendall-lakes-healthcare-and-rehab-center-Snapshot.docx");
});

it("D-13: blank displayName with .docx ext returns ccn-Snapshot.docx", () => {
  expect(slugFilename("", "686123", ".docx")).toBe("686123-Snapshot.docx");
});

it("D-13: default ext is still .pdf (backward compat)", () => {
  // No third arg — existing callers unaffected
  expect(slugFilename("Facility Name", "686123"))
    .toBe("facility-name-Snapshot.pdf");
});
```

---

### `src/components/SnapshotApp.tsx` (modify — swap DownloadPdfButton for ExportControls)

**Analog:** self (two-line change)

**Current import** (line 37):
```typescript
import { DownloadPdfButton } from "@/components/DownloadPdfButton";
```
Replace with:
```typescript
import { ExportControls } from "@/components/ExportControls";
```

**Current JSX** (line 198):
```tsx
<DownloadPdfButton vm={vm} />
```
Replace with:
```tsx
<ExportControls vm={vm} />
```

The Props interface of `ExportControls` is `{ vm: ReportViewModel | null }` — identical to `DownloadPdfButton`, so no call-site changes beyond the name.

---

## Shared Patterns

### Server-only module discipline
**Source:** `src/components/pdf/ReportPDF.tsx` (line 1 comment block), `src/components/DownloadPdfButton.tsx` (lines 19–23 comment block)
**Apply to:** `src/lib/docx/ReportDocx.ts`, `src/app/api/export/docx/route.ts`

```typescript
// From DownloadPdfButton.tsx lines 19-23:
// Security (T-03-09 / PITFALLS #4):
//   This file MUST NOT import @react-pdf/renderer or @/components/pdf/ReportPDF.
//   Those are server-only modules; importing them here causes `next build` to fail
//   (bundler error). The only PDF-related import is `ReportViewModel` as a *type*.
```

The same rule applies to `docx` and `ReportDocx.ts`. `ExportControls.tsx` must never import from `docx` or `@/lib/docx/ReportDocx`.

### Clean error envelope (D-05 discipline)
**Source:** `src/app/api/export/pdf/route.tsx` lines 36–60
**Apply to:** `src/app/api/export/docx/route.ts`

```typescript
return Response.json(
  {
    error: {
      kind: "invalid_request",
      message: "Invalid report data.",
    },
  },
  { status: 400 },
);
```

Both the non-JSON catch and the `safeParse` failure return this exact envelope. No Zod internals (`.issues`, `.paths`, `.codes`) ever reach the response body.

### D-08 inline retry error (never ErrorBanner)
**Source:** `src/components/DownloadPdfButton.tsx` lines 73–76, 98–101
**Apply to:** `src/components/ExportControls.tsx`

```typescript
// In catch block — fixed UI string, never raw server error:
setExportError("Couldn't generate PDF — try again.");

// In JSX — role="alert", button stays enabled:
{exportError && (
  <p role="alert" className="text-sm text-red-600 mt-1">
    {exportError}
  </p>
)}
```

### WR-02 deferred revokeObjectURL
**Source:** `src/components/DownloadPdfButton.tsx` line 71
**Apply to:** `src/components/ExportControls.tsx`

```typescript
setTimeout(() => URL.revokeObjectURL(url), 0);
// Keep the blob URL alive until after the click event commits — WebKit/mobile engines
// may abort the download if revoked synchronously.
```

### Formatters and N/A semantics
**Source:** `src/components/pdf/ReportPDF.tsx` lines 214–246
**Apply to:** `src/lib/docx/ReportDocx.ts`

The exact format calls and fallback values are:
- `formatLocation(f.address)` for Location
- `formatBeds(f.certifiedBeds)` for Census Capacity
- `formatRating(...)` for all four star ratings
- `formatDate(f.processingDate)` for footer date
- `m.emr ?? "—"` pattern for all manual fields (em dash, not N/A, not empty string)
- `m.currentCensus != null ? String(m.currentCensus) : "—"` for Current Census (number field)
- `renderMetricValue(metric)` for each `HospMetric` (`null` → `formatFootnote`; preserve real `0`)

---

## No Analog Found

All files in Phase 6 have a close match in the codebase. No entries.

---

## Metadata

**Analog search scope:** `medelite-report/src/`, `medelite-report/tests/`
**Files scanned:** 8 source files read in full
**Pattern extraction date:** 2026-06-19
**Key identifiers carried verbatim across all files:**
- `ReportViewModelSchema.safeParse` — route validation
- `export const runtime = "nodejs"` — route runtime declaration
- `new Uint8Array(buffer)` — BodyInit cast for `Response`
- `slugFilename(displayName, ccn, ".docx")` — filename with D-13 ext param
- `"View official CMS profile on Medicare.gov"` — footer link label (exact string)
- `"Hospitalization & ED metrics are temporarily unavailable."` — D-09 degraded text (exact string)
- `setTimeout(() => URL.revokeObjectURL(url), 0)` — WR-02 deferred revoke
- `"—"` (em dash) — manual field fallback (not "N/A", not empty)
- `vm.header.reportTitle` / `vm.header.stateLine` — header fields (never `f.displayName` in header)
- `f.careCompareUrl` — hyperlink target (already validated by schema)
- `link` (not `href`) — `ExternalHyperlink` property name in docx v9
