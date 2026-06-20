// types.ts — curated camelCase domain model (D-14).
//
// FacilityData is the camelCase boundary: no CMS snake_case names are re-exported
// from this file. CMS snake_case lives only in schema.ts (ParsedProvider) and
// mapper.ts (Plan 02-02). All field names traced to tests/fixtures/provider-686123.json
// and NH_Data_Dictionary (CLAUDE.md rule #3).
//
// HospMetric is the domain type for one hospitalization/ED data point (Phase 5 / Plan 02).
// Source: joinClaimsAndAverages() in claims-mapper.ts — the ONLY file that names CMS
// average column substrings. All 12 rows verbatim-labeled per D-04.
//
// Field → CMS source (verified in provider-686123.json):
//   ccn              ← cms_certification_number_ccn  (string, leading zeros preserved)
//   providerName     ← provider_name                 (D-15: NOT legal_business_name)
//   address.street   ← provider_address
//   address.city     ← citytown                      (NOT provider_city)
//   address.state    ← state                         (NOT provider_state)
//   state            ← state                         (top-level, for assembleHeader(state))
//   certifiedBeds    ← number_of_certified_beds
//   processingDate   ← processing_date               (D-12 freshness signal)
//   starRatings.overall         ← overall_rating
//   starRatings.healthInspection← health_inspection_rating
//   starRatings.staffing        ← staffing_rating
//   starRatings.qualityCare     ← qm_rating          (D-16: NOT longstay_qm_rating / shortstay_qm_rating)
//   (ZIP is excluded — DATA-03: no ZIP in address per reference output)

/**
 * A single hospitalization/ED data point — one of the 12 rows in the claims metrics section.
 * Source: joinClaimsAndAverages() in claims-mapper.ts (Phase 5 / Plan 02).
 *
 * All field names are camelCase (D-14). No CMS snake_case names leak out of claims-mapper.ts.
 * The 12 verbatim labels come from the reference template (D-04 — garbles preserved).
 */
export interface HospMetric {
  /** Verbatim label from the reference template (D-04 — garbles preserved as-is). */
  label: string;

  /**
   * Facility adjusted score or national/state average value.
   * null when CMS suppressed the value (empty adjusted_score) or when the measure
   * is absent from the claims response (fewer-than-4 partial — D-10/SC#5).
   * Source: adjusted_score (facility rows) or description-matched average column (D-14).
   */
  value: number | null;

  /**
   * Formatter kind: "percent" → formatPercent (1 dp + "%"), "rate" → formatRate (2 dp).
   * Drives which formatter is called at render time (D-12).
   * short-stay measures 521/522 and their averages → "percent".
   * long-stay measures 551/552 and their averages → "rate".
   */
  unit: "percent" | "rate";

  /**
   * CMS footnote code string (D-11). Present and non-empty when CMS suppressed the value.
   * Empty string "" when the score is absent but no footnote code was provided.
   * Absent (undefined) for national/state average rows (averages are never suppressed per-row).
   * formatFootnote(footnoteCode) maps this to a human-readable suppression message.
   */
  footnoteCode?: string;

  /**
   * D-15: measure group key for chart rendering (Phase 7).
   * Matches METRIC_DEFINITIONS measureCode in claims-mapper.ts.
   * Used by groupByMeasure() in chart-utils.ts to bucket the 12 flat rows into 4 groups.
   */
  measureKey: "521" | "522" | "551" | "552";

  /**
   * D-15: data source within the measure group.
   * Used by groupByMeasure() to populate facility/nation/state slots in each MeasureGroup.
   */
  source: "facility" | "nation" | "state";
}

export interface FacilityData {
  /** CMS certification number — preserved as string (leading zeros). */
  ccn: string;

  /** Operating name of facility. Source: provider_name (D-15). */
  providerName: string;

  /** Composed address (no ZIP per DATA-03). */
  address: {
    street: string;
    city: string;
    state: string;
  };

  /**
   * State abbreviation (top-level copy for assembleHeader(state)).
   * Source: state field.
   */
  state: string;

  /** Census Capacity. Source: number_of_certified_beds. */
  certifiedBeds: number | null;

  /** CMS data freshness date. Source: processing_date (D-12). */
  processingDate: string;

  /**
   * CMS star ratings. All four from Provider Information dataset (4pq5-n9py).
   * qualityCare = qm_rating (D-16 — NOT longstay_qm_rating / shortstay_qm_rating).
   */
  starRatings: {
    overall: number | null;
    healthInspection: number | null;
    staffing: number | null;
    qualityCare: number | null;
  };
}
