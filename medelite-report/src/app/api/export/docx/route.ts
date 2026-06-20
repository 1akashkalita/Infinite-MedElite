// app/api/export/docx/route.ts — DOCX export route (DOCX-01 / D-12).
//
// Accepts POST with a full ReportViewModel body. Validates using ReportViewModelSchema (D-12).
// Bad shape → 400 { error: { kind: 'invalid_request', message } } — NO Zod internals (D-05).
// Valid body → Packer.toBuffer(buildReportDocx(vm)) → 200 OOXML response (DOCX-01).
//
// Contract mirrors POST /api/export/pdf exactly; only the render call and MIME/ext differ:
//   renderToBuffer(<ReportPDF/>) → Packer.toBuffer(buildReportDocx(vm))
//   Content-Type: application/pdf → application/vnd.openxmlformats-officedocument.wordprocessingml.document
//   filename.pdf → filename.docx (via slugFilename(..., ".docx"))
//
// export const runtime = "nodejs": the docx Packer needs Node Buffer/zip — identical
//   rationale to the PDF route's @react-pdf/renderer requirement. (D-12 / D-25)
//
// NOTE: "docx" does NOT need to be added to serverExternalPackages in next.config.ts.
//   It is pure CJS with no native bindings — verified in 06-RESEARCH Q1. Leave next.config.ts
//   unchanged; only "@react-pdf/renderer" is listed there.

import { Packer } from "docx";
import { buildReportDocx } from "@/lib/docx/ReportDocx";
import { slugFilename } from "@/lib/report/slug";
import { ReportViewModelSchema } from "@/lib/report/view-model";

/** D-25: explicit Node.js runtime — the docx Packer requires Node Buffer/zip. */
export const runtime = "nodejs";

/**
 * POST /api/export/docx — Word document export (DOCX-01).
 *
 * D-12: validates the incoming ReportViewModel body via ReportViewModelSchema.safeParse.
 * D-05: bad shape → clean 400 envelope (NO Zod internals in the response body).
 * DOCX-01: valid body → Packer.toBuffer(buildReportDocx(vm)) → 200 OOXML buffer.
 */
export async function POST(request: Request): Promise<Response> {
  // A non-JSON body throws here; the route contract is 400 invalid_request for bad input,
  // not a bare 500. Same clean-envelope discipline as the parse-failure branch below (D-05).
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

  const parseResult = ReportViewModelSchema.safeParse(body);

  if (!parseResult.success) {
    // D-12 / D-05: return a clean error envelope — NO Zod internals (paths, issues, codes).
    // Full validation details go to server logs only (same discipline as the PDF route).
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

  // DOCX-01: build the Word document and stream it as a buffer.
  // Packer.toBuffer returns Promise<Buffer>; Buffer extends Uint8Array at runtime,
  // so `new Uint8Array(docxBuffer)` is the correct lossless cast for the Web Response API
  // (mirrors the PDF route's `new Uint8Array(pdfBuffer)` at line 70 of route.tsx).
  const docxBuffer = await Packer.toBuffer(buildReportDocx(parseResult.data));
  const filename = slugFilename(
    parseResult.data.facility.displayName,
    parseResult.data.facility.ccn,
    ".docx", // D-13: ext parameter — both routes share the injection-safe slugFilename helper
  );
  return new Response(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
