// PdfMiniBarChart.tsx — PDF grouped bar chart for one hospitalization/ED measure group.
//
// Renders a native react-pdf bar chart using @react-pdf/renderer's SVG primitives (Svg, Rect,
// Line, G) for bars and axis lines, and react-pdf <View>/<Text> for all text labels (legend).
// Text is deliberately kept OUTSIDE the <Svg> element to avoid react-pdf's SVG font encoding,
// which uses glyph IDs in a separate CID font map rather than the standard ASCII TJ operator
// path used by react-pdf's regular Text elements. Mixing SVG-encoded and standard-encoded text
// in a single PDF page causes font table collisions that can prevent text extraction from the
// page content stream (the standard content stream falls back to a non-ASCII glyph-ID encoding
// that defeats the extractTextFromPdf helper in the existing CLM-03 test assertions).
//
// Layout: bars rendered in <Svg> (pure geometry), labels rendered as react-pdf View/Text
// outside the SVG, using react-pdf's flexbox layout.
//
// D-08: color legend below the chart (series name text in react-pdf Text, not Svg Text).
// D-09 suppression: empty data → <Text>N/A</Text> (no empty chart frame).
//
// NO "use client" — server-only. Never import from a client component.

import React from "react";
import { G, Svg, Rect, Line } from "@react-pdf/renderer";
import { View, Text } from "@react-pdf/renderer";
import { buildChartData } from "@/lib/charts/chart-data";
import type { MeasureGroup } from "@/lib/report/chart-utils";

interface Props {
  group: MeasureGroup;
}

/**
 * PDF grouped-bar chart for one hospitalization/ED measure group.
 *
 * D-07: up to 3 bars — Facility (blue) / National (green) / State (amber).
 * D-08: color legend with series name text below the chart (react-pdf Text, not SVG text).
 * D-09: all-suppressed → N/A Text; partial → only present bars rendered.
 * VIZ-02: native react-pdf SVG primitives for bars; standard Text outside SVG for labels.
 */
export function PdfMiniBarChart({ group }: Props) {
  const data = buildChartData(group);

  // D-09: all bars suppressed → N/A text (no empty chart frame)
  if (data.length === 0) {
    return (
      <View style={{ paddingVertical: 4 }}>
        <Text
          style={{
            fontSize: 8,
            color: "#9ca3af",
            fontFamily: "Helvetica-Oblique",
          }}
        >
          N/A
        </Text>
      </View>
    );
  }

  // ---- Layout constants ----
  // SVG for pure bar geometry + axis lines only (no Text inside Svg to avoid font encoding issues).
  const SVG_W = 280;
  const SVG_H = 90;
  const PAD_LEFT = 8;
  const PAD_RIGHT = 8;
  const PAD_TOP = 4;
  const PAD_BOTTOM = 4;
  const CHART_W = SVG_W - PAD_LEFT - PAD_RIGHT;
  const CHART_H = SVG_H - PAD_TOP - PAD_BOTTOM;
  const n = data.length;
  const BAR_W = Math.floor((CHART_W / n) * 0.6);
  const BAR_GAP = Math.floor((CHART_W / n) * 0.4);

  // Y-axis scale
  const maxVal = Math.max(...data.map((d) => d.value));
  const yMax = maxVal <= 0 ? 1 : Math.ceil(maxVal * 1.1);

  // Y coordinate (SVG y grows downward)
  const toY = (v: number) =>
    PAD_TOP + CHART_H - Math.round((v / yMax) * CHART_H);

  return (
    <View style={{ marginBottom: 6 }}>
      {/* Pure SVG geometry: bars + axis lines only (NO Text inside Svg) */}
      <Svg width={SVG_W} height={SVG_H} style={{ backgroundColor: "#ffffff" }}>
        {/* Y-axis line */}
        <Line
          x1={PAD_LEFT}
          y1={PAD_TOP}
          x2={PAD_LEFT}
          y2={PAD_TOP + CHART_H}
          stroke="#9ca3af"
          strokeWidth={1}
        />
        {/* Baseline */}
        <Line
          x1={PAD_LEFT}
          y1={PAD_TOP + CHART_H}
          x2={PAD_LEFT + CHART_W}
          y2={PAD_TOP + CHART_H}
          stroke="#9ca3af"
          strokeWidth={1}
        />

        {/* Bars */}
        {data.map((d, i) => {
          const x =
            PAD_LEFT + Math.round((i * CHART_W) / n) + Math.round(BAR_GAP / 2);
          const y = toY(d.value);
          const barH = Math.max(1, PAD_TOP + CHART_H - y);
          return (
            <Rect
              key={i}
              x={x}
              y={y}
              width={BAR_W}
              height={barH}
              fill={d.color}
            />
          );
        })}

        {/* Tick marks at 0, midpoint, and max (geometry only, no text) */}
        {[0, yMax / 2, yMax].map((v) => {
          const y = toY(v);
          return (
            <G key={v}>
              <Line
                x1={PAD_LEFT - 3}
                y1={y}
                x2={PAD_LEFT}
                y2={y}
                stroke="#9ca3af"
                strokeWidth={1}
              />
            </G>
          );
        })}
      </Svg>

      {/* D-08: Legend — react-pdf Text OUTSIDE Svg (uses standard PDF TJ encoding, */}
      {/* not SVG CID font encoding, so CLM-03 text extraction continues to work).   */}
      <View
        style={{
          flexDirection: "row",
          justifyContent: "center",
          flexWrap: "wrap",
          gap: 6,
          marginTop: 2,
        }}
      >
        {data.map((d, i) => (
          <View
            key={i}
            style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
          >
            {/* Color swatch as a tiny Svg — only geometry, no text */}
            <Svg width={10} height={8}>
              <Rect x={0} y={0} width={10} height={8} fill={d.color} />
            </Svg>
            <Text
              style={{
                fontSize: 7,
                color: "#374151",
                fontFamily: "Helvetica",
              }}
            >
              {d.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
