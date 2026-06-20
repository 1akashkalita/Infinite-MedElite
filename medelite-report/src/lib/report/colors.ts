// colors.ts — shared brand/band color constants for web, PDF, and docx renderers.
//
// STAR_BAND_HEX: performance band hex colors shared across PDF (react-pdf) and docx (OOXML).
// STAR_BAND_WEB: Tailwind class equivalents for web (StarRating.tsx, ReportPreview.tsx).
// CHART_SERIES:  SERIES IDENTITY colors (not performance bands — see D-08 warning below).
//
// D-08 WARNING: CHART_SERIES colors are series identifiers (facility vs. national vs. state).
// They are NOT performance indicators and must NOT be confused with STAR_BAND colors.
// The green in CHART_SERIES.nation is a series identity, not "good" / "5 stars".
// Always include a legend when rendering chart series so readers know what each color means.

/** Hex colors for star rating performance bands. Shared by PDF and docx renderers. */
export const STAR_BAND_HEX = {
  /** 4–5 stars: strong performance */
  green: "#16a34a",
  /** 3 stars: average performance */
  amber: "#f59e0b",
  /** 1–2 stars: below average performance */
  red: "#dc2626",
  /** null / suppressed: no rating available */
  grey: "#9ca3af",
} as const;

/** Tailwind text-color classes for star rating bands in the web preview. */
export const STAR_BAND_WEB: Record<string, string> = {
  green: "text-green-600",
  amber: "text-amber-500",
  red: "text-red-600",
  grey: "text-zinc-400",
};

/**
 * Chart series identity colors for hospitalization/ED metric bar charts.
 * These are SERIES IDENTITIES — not performance indicators (D-08).
 * Visually distinct from STAR_BAND to avoid confusion.
 * Always render with a legend.
 */
export const CHART_SERIES = {
  /** Facility bar color — blue (series identity) */
  facility: "#3b82f6",
  /** National average bar color — green (series identity, NOT "good") */
  nation: "#16a34a",
  /** State average bar color — amber (series identity, NOT "warning") */
  state: "#f59e0b",
} as const;
