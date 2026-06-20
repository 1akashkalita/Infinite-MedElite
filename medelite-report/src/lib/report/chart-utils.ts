// chart-utils.ts — D-15 metric grouping utility for hospitalization/ED charts.
//
// groupByMeasure takes the flat 12-row HospMetric[] (from claims-mapper) and groups
// them into 4 MeasureGroup buckets in the canonical measure order (521, 522, 551, 552).
// Each group has { facility?, nation?, state? } slots plus a chart-section caption (label)
// and unit for axis formatting.
//
// NOTE: the MeasureGroup.label is a CHART SECTION CAPTION, NOT the verbatim CLM-03 row label.
// The 12 verbatim labels (D-04) are in METRIC_DEFINITIONS in claims-mapper.ts and drive the
// tabular rows in all three renderers — they are NEVER replaced by these captions.
//
// D-09 partial-chart support: if a measure group has no facility row (D-10/SC#5 partial),
// groupByMeasure still returns 4 groups; the missing slot is undefined (not null).
// Chart components filter out undefined slots before rendering.

import type { HospMetric } from "@/lib/cms/types";

/** One of the 4 CMS hospitalization/ED measure codes. */
export type MeasureKey = "521" | "522" | "551" | "552";

/**
 * One measure group for chart rendering — contains up to 3 slots (facility/nation/state).
 * Chart-section caption (label) is a DISPLAY CAPTION, not a verbatim CLM-03 row label.
 */
export interface MeasureGroup {
  /** Canonical measure key — matches HospMetric.measureKey. */
  key: MeasureKey;
  /** Chart section display caption (NOT a verbatim CLM-03 label). */
  label: string;
  /** Unit for axis/tooltip formatting. */
  unit: "percent" | "rate";
  /** Facility data point — undefined if absent from claims response (D-09). */
  facility?: HospMetric;
  /** National average data point — undefined if averages not fetched. */
  nation?: HospMetric;
  /** State average data point — undefined if averages not fetched. */
  state?: HospMetric;
}

// Seed definitions: measure captions + units in fixed canonical order.
// These chart-section captions differ from the verbatim CLM-03 row labels in METRIC_DEFINITIONS.
const MEASURE_SEEDS: ReadonlyArray<{
  key: MeasureKey;
  label: string;
  unit: "percent" | "rate";
}> = [
  { key: "521", label: "Short-Stay Rehospitalization", unit: "percent" },
  { key: "522", label: "Short-Stay ED Visits", unit: "percent" },
  { key: "551", label: "Long-Stay Hospitalizations", unit: "rate" },
  { key: "552", label: "Long-Stay ED Visits", unit: "rate" },
];

/**
 * Groups a flat HospMetric[] into 4 MeasureGroup objects in fixed order (521, 522, 551, 552).
 *
 * Each input HospMetric must carry measureKey and source fields (D-15).
 * Metrics with unrecognized measureKey are silently skipped (defensive).
 *
 * @param metrics - The flat 12-row (or partial) HospMetric array from claims-mapper.
 * @returns Array of 4 MeasureGroup objects in canonical measure order.
 */
export function groupByMeasure(metrics: HospMetric[]): MeasureGroup[] {
  // Initialize 4 groups from seeds.
  const groups: Record<MeasureKey, MeasureGroup> = {
    "521": { ...MEASURE_SEEDS[0] },
    "522": { ...MEASURE_SEEDS[1] },
    "551": { ...MEASURE_SEEDS[2] },
    "552": { ...MEASURE_SEEDS[3] },
  };

  for (const m of metrics) {
    const group = groups[m.measureKey as MeasureKey];
    if (!group) continue; // unrecognized key — skip defensively
    group[m.source] = m;
  }

  // Return in fixed canonical order.
  return (["521", "522", "551", "552"] as MeasureKey[]).map((k) => groups[k]);
}
