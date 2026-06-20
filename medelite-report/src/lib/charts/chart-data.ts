// chart-data.ts — Shared (client + server) chart data builder.
//
// Contains the ChartDatum type and buildChartData mapper.
// This file has NO server-only imports — it is safe for use in "use client" components
// such as MiniBarChart.tsx. The server-only SVG generation (renderChartSvgString) lives
// in chart-svg.ts (which imports react-dom/server and is server-only).
//
// buildChartData: maps a MeasureGroup to the ChartDatum[] array consumed by chart components.
//   - Filters out slots whose value is null (D-09 suppression — omit bar, not "0" bar).
//   - Colors come from the shared CHART_SERIES constants (D-08: series identity, NOT performance bands).

import { CHART_SERIES } from "@/lib/report/colors";
import type { MeasureGroup } from "@/lib/report/chart-utils";

// ---------------------------------------------------------------------------
// ChartDatum — the data shape consumed by both MiniBarChart and renderChartSvgString
// ---------------------------------------------------------------------------

/** One bar in a grouped bar chart: a named data point with a value and series color. */
export interface ChartDatum {
  /** Series name — "Facility", "National", or "State". */
  name: string;
  /** Numeric value (already filtered — never null in a ChartDatum). */
  value: number;
  /** Series color hex — from CHART_SERIES (D-08 series identity, not performance band). */
  color: string;
}

// ---------------------------------------------------------------------------
// buildChartData — map a MeasureGroup to ChartDatum[], filtering suppressed slots (D-09)
// ---------------------------------------------------------------------------

/**
 * Maps a MeasureGroup to a ChartDatum array for chart rendering.
 *
 * Slots where value === null are filtered OUT (D-09 suppression rule — omit bar entirely,
 * do not render a "0" bar). A partially-suppressed group returns only the available bars.
 * An all-suppressed group returns [] (caller renders an N/A indication per D-09).
 *
 * Colors come from CHART_SERIES (D-08: series identity — facility=blue, national=green, state=amber;
 * these are NOT performance indicators — always render with a legend so readers know what each
 * color means).
 *
 * @param group — A MeasureGroup from groupByMeasure(vm.hospMetrics).
 * @returns ChartDatum[] with only non-null slots (may be empty for all-suppressed groups).
 */
export function buildChartData(group: MeasureGroup): ChartDatum[] {
  const candidates: ChartDatum[] = [];

  if (group.facility !== undefined && group.facility.value !== null) {
    candidates.push({
      name: "Facility",
      value: group.facility.value,
      color: CHART_SERIES.facility,
    });
  }
  if (group.nation !== undefined && group.nation.value !== null) {
    candidates.push({
      name: "National",
      value: group.nation.value,
      color: CHART_SERIES.nation,
    });
  }
  if (group.state !== undefined && group.state.value !== null) {
    candidates.push({
      name: "State",
      value: group.state.value,
      color: CHART_SERIES.state,
    });
  }

  return candidates;
}
