"use client";

// DownloadPdfButton.tsx — Client "Download PDF" button (D-05 / D-07 / D-08).
//
// D-05: PDF generation is entirely server-side. This component only orchestrates
//   the download: POST the assembled ReportViewModel to /api/export/pdf, receive
//   the response as a Blob, trigger a silent anchor download via URL.createObjectURL.
//   No navigation, no new tab, no pop-up.
//
// D-07: Button states — disabled + "Generating…" label while the request is in
//   flight; re-enabled after. Also disabled until a successful facility fetch has
//   produced a view-model (vm === null → nothing to export).
//
// D-08: Export failures are local. On any export failure (400, 5xx, network drop),
//   show a small inline error <p role="alert"> below the button and keep the button
//   ENABLED for retry. Do NOT route export errors through the top ErrorBanner — that
//   is reserved for Phase-3 CMS lookup errors only.
//
// Security (T-03-09 / PITFALLS #4):
//   This file MUST NOT import @react-pdf/renderer or @/components/pdf/ReportPDF.
//   Those are server-only modules; importing them here causes `next build` to fail
//   (bundler error). The only PDF-related import is `ReportViewModel` as a *type*.

import { useState } from "react";
import type { ReportViewModel } from "@/lib/report/view-model";

interface Props {
  /** The assembled view-model to export. Null when no successful fetch exists. */
  vm: ReportViewModel | null;
}

/**
 * Download PDF button.
 *
 * POSTs the assembled ReportViewModel to /api/export/pdf, receives the PDF
 * as a Blob, and triggers a silent anchor download (D-05). Handles D-07 loading
 * states and D-08 inline retry error.
 *
 * NEVER imports @react-pdf/renderer or ReportPDF (T-03-09 / PITFALLS #4).
 */
export function DownloadPdfButton({ vm }: Props) {
  const [loading, setLoading] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleDownload(): Promise<void> {
    // D-07: guard — nothing to export without a vm
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
      // Fallback download hint — the server Content-Disposition controls the real filename (D-06)
      a.download = "report.pdf";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // D-08: surface a fixed UI-authored string; never the raw server response or Zod internals.
      // Keep button enabled for retry (loading will be cleared in finally).
      setExportError("Couldn't generate PDF — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={loading || !vm}
        className={[
          "rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors",
          loading || !vm
            ? "cursor-not-allowed bg-blue-300"
            : "bg-blue-600 hover:bg-blue-700 active:bg-blue-800",
        ].join(" ")}
      >
        {loading ? "Generating…" : "Download PDF"}
      </button>

      {/* D-08: inline error beside/below the button — NOT ErrorBanner */}
      {exportError && (
        <p role="alert" className="text-sm text-red-600 mt-1">
          {exportError}
        </p>
      )}
    </div>
  );
}
