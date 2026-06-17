// CMSRowSchema — validates a single provider row from the CMS Provider Data Catalog API.
//
// Field names verified against tests/fixtures/provider-686123.json (CLAUDE.md rule #3).
// Dataset: Provider Information (4pq5-n9py); CCN: 686123.
//
// Design decisions (from 01-CONTEXT.md):
//   D-04: .passthrough() — only depended-on fields are modeled; ~90 others pass through.
//   D-05: required keys with .nullable() values (NOT .optional()) — missing key fails loud.
//   D-07: numeric strings are coerced to numbers inside the schema (single source of truth).
//   D-08: empty/whitespace → null BEFORE numeric coercion (z.coerce.number("") = 0 trap).
//   D-09: a real "0" is preserved as 0 (only empty/whitespace becomes null).
//   D-10: CCN and ZIP stay as strings — never coerced (preserves leading zeros).

import { z } from "zod";

// Helper: validate a CMS numeric field. CMS returns these as strings (often "" when
// suppressed), as a real number, or null — never as a boolean/array/object.
// Behaviors:  ""/"   " → null  |  "0" → 0  |  "5" → 5  |  null → null  |  5 → 5
// A non-numeric string OR any other type (boolean, array, object) is REJECTED, so
// malformed CMS data can never be silently coerced into a fabricated number
// (CLAUDE.md rule #4 / review CR-01). z.coerce.number() is intentionally NOT used
// because Number(true) === 1 and Number([]) === 0 would pass validation.
const nullableNum = z
  .union([z.string(), z.number(), z.null()])
  .transform((v, ctx) => {
    if (v === null) return null;
    if (typeof v === "number") return v;
    const trimmed = v.trim();
    if (trimmed === "") return null;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) {
      ctx.addIssue({
        code: "custom",
        message: `Expected a numeric string, got "${v}"`,
      });
      return z.NEVER;
    }
    return n;
  });

export const CMSRowSchema = z
  .object({
    // Identity fields — preserved as strings (D-10: never coerce CCN or ZIP)
    // Field names verified live in tests/fixtures/provider-686123.json
    cms_certification_number_ccn: z.string(),
    zip_code: z.string(),

    // Required text fields (verified in provider-686123.json)
    provider_name: z.string(),
    legal_business_name: z.string(),
    provider_address: z.string(),
    citytown: z.string(),
    state: z.string(),
    processing_date: z.string(),

    // Numeric (string-encoded in CMS API; coerced to number via nullableNum — D-07/D-08)
    number_of_certified_beds: nullableNum,

    // Star ratings — required keys, nullable values (D-05/D-06).
    // CMS returns "" for suppressed data; empty string must become null, not 0 (D-08).
    // qm_rating = Quality of Resident Care (NOT longstay_qm_rating / shortstay_qm_rating)
    // per CLAUDE.md field mapping.
    overall_rating: nullableNum,
    health_inspection_rating: nullableNum,
    qm_rating: nullableNum,
    staffing_rating: nullableNum,
  })
  .passthrough(); // D-04: ~90 unmodeled CMS columns pass through untouched

// ParsedProvider is the typed output of CMSRowSchema.
// Consumers (Phase 2 route handler, ReportViewModel) use this type.
export type ParsedProvider = z.infer<typeof CMSRowSchema>;
