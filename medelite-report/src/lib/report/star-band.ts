// star-band.ts — pure star rating band + glyph helpers.
//
// getStarBand: maps a rating (number | null) → performance band key.
// buildStarGlyphs: maps a rating (1–5) → Unicode glyph string "★★★☆☆".
//
// D-06: null ratings are never coerced via falsiness — always use === null.
//       A real 0 is valid CMS data but 0 is not a valid star rating (1–5 scale).
//       The null guard handles the suppressed/absent case; the caller is responsible
//       for not calling buildStarGlyphs with null or 0.

/**
 * Maps a CMS star rating (1–5) or null to a performance band key.
 *
 * Band assignments:
 *   4–5 → "green"  (strong performance)
 *   3   → "amber"  (average performance)
 *   1–2 → "red"    (below average)
 *   null → "grey"  (suppressed / no rating)
 *
 * D-06: uses strict `=== null` check, never falsiness.
 * Real 0 is valid data but not a valid CMS star rating — callers must not
 * pass 0 (the CMS schema already enforces 1–5 for valid ratings).
 */
export function getStarBand(
  rating: number | null,
): "green" | "amber" | "red" | "grey" {
  if (rating === null) return "grey";
  if (rating >= 4) return "green";
  if (rating === 3) return "amber";
  return "red";
}

/**
 * Builds a 5-glyph Unicode star string for a numeric rating.
 *
 * Examples:
 *   buildStarGlyphs(4) → "★★★★☆"
 *   buildStarGlyphs(1) → "★☆☆☆☆"
 *   buildStarGlyphs(5) → "★★★★★"
 *
 * Assumes `rating` is a valid integer in the range 1–5.
 * The caller is responsible for null-checking before calling this helper.
 * Unicode ★/☆ pass through xmlEsc in docx renderer safely (not HTML-entity-escaped).
 */
export function buildStarGlyphs(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}
