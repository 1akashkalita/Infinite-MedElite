// types.ts — curated camelCase domain model (D-14).
//
// FacilityData is the camelCase boundary: no CMS snake_case names are re-exported
// from this file. CMS snake_case lives only in schema.ts (ParsedProvider) and
// mapper.ts (Plan 02-02). All field names traced to tests/fixtures/provider-686123.json
// and NH_Data_Dictionary (CLAUDE.md rule #3).
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
