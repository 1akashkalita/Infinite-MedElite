"use client";

/**
 * SnapshotApp — Wave 2 skeleton shell.
 *
 * Renders the two-pane layout (D-01) with a greyed paper-like skeleton
 * preview (D-02/D-06). No fetch or manual inputs yet — those land in
 * Waves 3-4. No imports from @/lib/cms/client or @react-pdf/renderer
 * (RESEARCH Pitfall 1 — client-bundle safety).
 */
export function SnapshotApp() {
  return (
    <div className="flex flex-col lg:flex-row gap-6 p-6 min-h-screen bg-zinc-50">
      {/* Left pane — search + manual inputs (populated in Waves 3-4) */}
      <div className="flex-1 flex flex-col gap-4">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Infinite Snapshot
        </h1>
        <p className="text-sm text-zinc-500">
          Enter a CMS Certification Number (CCN) to generate a facility
          assessment snapshot.
        </p>
        {/* Placeholder for CCNSearchBar (Wave 3) */}
        <div className="rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-400">
          Search bar coming soon&hellip;
        </div>
      </div>

      {/* Right pane — paper-like skeleton preview (D-02/D-06) */}
      <div className="flex-1">
        <div className="bg-white rounded shadow p-8 animate-pulse space-y-4">
          {/* Header block skeleton */}
          <div className="h-6 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-px bg-gray-100 my-4" />
          {/* Facility info skeleton */}
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-px bg-gray-100 my-4" />
          {/* Star ratings skeleton */}
          <div className="h-4 bg-gray-200 rounded w-3/5" />
          <div className="h-4 bg-gray-200 rounded w-2/5" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="h-4 bg-gray-200 rounded w-2/5" />
          <div className="h-px bg-gray-100 my-4" />
          {/* Manual fields skeleton */}
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-2/3" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    </div>
  );
}
