// client.ts — fetchFacility(ccn): Promise<FacilityData>
//
// Full pipeline: URL build → fetch with 8s timeout → status check → Zod validate → map.
// Throws typed CmsError for every failure mode (D-18/D-19).
//
// Security notes:
//   T-02-SSRF: host+path come from fixed constants (CMS_BASE_URL/DATASET_PROVIDER_INFO).
//              CCN is passed ONLY as a conditions[0][value] — never concatenated into host/path.
//   T-02-DOS: AbortSignal.timeout(8000) caps upstream CMS latency (D-19).
//   T-02-LEAK: validation_error CmsError carries no extra field; prettified Zod issues are
//              console.error'd server-side only (D-05/D-06).
//
// CCN format gating is the route handler's responsibility (D-22 / Task 3).
// This function receives a pre-validated, normalized CCN.

import { z } from "zod";
import { safeParseCMSRow } from "@/lib/cms/parse";
import { toFacilityData } from "@/lib/cms/mapper";
import { CmsError } from "@/lib/cms/errors";
import {
  CMS_BASE_URL,
  DATASET_PROVIDER_INFO,
  DATASET_CLAIMS,
  DATASET_AVERAGES,
  CCN_FILTER_FIELD,
  AVERAGES_FILTER_FIELD,
} from "@/lib/cms/constants";
import type { FacilityData } from "@/lib/cms/types";
import { ClaimsRowSchema, type ClaimsRow } from "@/lib/cms/claims-schema";
import { AveragesRowSchema, type AveragesRow } from "@/lib/cms/averages-schema";

/**
 * Fetches a single facility from the CMS Provider Information dataset by CCN.
 *
 * Pipeline:
 *   1. Build URL from fixed constants + CCN as a condition value only (T-02-SSRF)
 *   2. Fetch with 8s AbortSignal.timeout (D-19 — fail fast; no auto-retry in v1, D-23)
 *   3. Non-200 → cms_api_error (D-18)
 *   4. Zero rows → not_found
 *   5. Zod validate via safeParseCMSRow → validation_error on failure (D-05/D-06)
 *   6. toFacilityData → FacilityData (camelCase domain model, D-14)
 *
 * @param ccn - Pre-validated, normalized 6-alphanumeric CCN from the route handler (D-22)
 * @throws {CmsError} kind: network_error | cms_api_error | not_found | validation_error
 */
export async function fetchFacility(ccn: string): Promise<FacilityData> {
  // Build URL: host+path from fixed constants; CCN is only a condition value (T-02-SSRF)
  const url = new URL(`${CMS_BASE_URL}/${DATASET_PROVIDER_INFO}/0`);
  url.searchParams.set("conditions[0][property]", CCN_FILTER_FIELD);
  url.searchParams.set("conditions[0][value]", ccn);
  // Single "=" operator — "==" returns HTTP 400 from CMS (verified in RESEARCH.md Pitfall 3)
  url.searchParams.set("conditions[0][operator]", "=");
  url.searchParams.set("limit", "1");

  // Fetch with 8s timeout (D-19: fail fast; catch both AbortError and network failures)
  let resp: Response;
  try {
    resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  } catch {
    // AbortError from timeout, network unreachable, ECONNREFUSED, etc.
    // D-04: retry copy OK for network_error (transient; user can try again)
    throw new CmsError(
      "network_error",
      "CMS data is unavailable — please try again.",
    );
  }

  // D-18: non-200 from CMS (5xx, 4xx, etc.)
  // D-04: retry copy OK for cms_api_error (transient)
  if (!resp.ok) {
    throw new CmsError(
      "cms_api_error",
      "CMS returned an error — please try again.",
    );
  }

  // Parse the JSON response — CMS returns { count, results }.
  // A 200 with a non-JSON body (maintenance page, truncated stream) throws here; that is a
  // CMS-side failure, so surface it as cms_api_error rather than letting a raw SyntaxError
  // escape to a bare 500 (D-18: every failure mode → typed CmsError).
  let json: { count?: number; results?: unknown };
  try {
    json = (await resp.json()) as { count?: number; results?: unknown };
  } catch {
    throw new CmsError(
      "cms_api_error",
      "CMS returned an error — please try again.",
    );
  }

  // Envelope-shape guard: `results` MUST be an array. A type assertion is not a runtime
  // check, so a changed CMS envelope would otherwise throw a raw TypeError on .length below.
  // A malformed envelope is a CMS API error (D-18), distinct from a row-level validation_error.
  if (!Array.isArray(json.results)) {
    throw new CmsError(
      "cms_api_error",
      "CMS returned an error — please try again.",
    );
  }
  const results = json.results;

  // Zero rows → not_found (CCN does not exist in the dataset)
  if (results.length === 0) {
    throw new CmsError(
      "not_found",
      `No facility found for CCN ${ccn}.`,
      { ccn }, // D-07: the normalized CCN echoed for route handler to include in 404 body
    );
  }

  // Zod validate via safeParseCMSRow (CLAUDE.md rule #4: never use unvalidated CMS data)
  const parseResult = safeParseCMSRow(results[0]);
  if (!parseResult.success) {
    // D-06: log server-side only — includes CCN + full prettified Zod issues
    console.error(
      `[validation_error] CCN=${ccn}`,
      z.prettifyError(parseResult.error),
    );
    // D-04/D-05: honest non-retry message; no Zod internals in the thrown error
    // ⚠ DELIBERATE: no extra field on validation_error CmsError (D-05 T-02-LEAK)
    throw new CmsError(
      "validation_error",
      "We couldn't read this facility's data right now.",
    );
  }

  // Map validated ParsedProvider to camelCase FacilityData (D-14/D-16)
  return toFacilityData(parseResult.data);
}

/**
 * Fetches facility hospitalization/ED claims measures from the CMS Medicare Claims
 * Quality Measures dataset (ijh5-nb2v), filtered by CCN.
 *
 * Returns up to 4 validated ClaimsRow objects (one per measure code: 521/522/551/552).
 * Invalid rows are silently dropped (graceful partial — RESEARCH Pattern 1).
 * Returns an empty array for zero results — the route handler interprets <4 rows as degraded.
 * Never throws for a valid-but-empty response; only throws CmsError on network/API failure.
 *
 * SSRF discipline (T-05-V5-SSRF):
 *   - URL host+path from fixed constants (CMS_BASE_URL + DATASET_CLAIMS).
 *   - CCN is passed ONLY as conditions[0][value] — never concatenated into host/path.
 * Timeout: AbortSignal.timeout(8000) — same 8s cap as fetchFacility (T-05-V5-DOS).
 *
 * @param ccn - Pre-validated, normalized CCN from the route handler.
 * @throws {CmsError} kind: network_error | cms_api_error
 */
export async function fetchClaimsMeasures(ccn: string): Promise<ClaimsRow[]> {
  // Build URL: host+path from fixed constants; CCN is only a condition value (T-05-V5-SSRF)
  const url = new URL(`${CMS_BASE_URL}/${DATASET_CLAIMS}/0`);
  url.searchParams.set("conditions[0][property]", CCN_FILTER_FIELD);
  url.searchParams.set("conditions[0][value]", ccn);
  url.searchParams.set("conditions[0][operator]", "=");
  url.searchParams.set("limit", "10"); // 4 expected; 10 is safe headroom

  // Fetch with 8s timeout (T-05-V5-DOS: fail fast; catch both AbortError and network failures)
  let resp: Response;
  try {
    resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
  } catch {
    throw new CmsError(
      "network_error",
      "Claims data is unavailable — please try again.",
    );
  }

  // Non-200 from CMS
  if (!resp.ok) {
    throw new CmsError(
      "cms_api_error",
      "CMS returned an error for claims data — please try again.",
    );
  }

  // Parse JSON — a 200 with a non-JSON body (maintenance page, etc.) → cms_api_error
  let json: { count?: number; results?: unknown };
  try {
    json = (await resp.json()) as { count?: number; results?: unknown };
  } catch {
    throw new CmsError(
      "cms_api_error",
      "CMS returned an error for claims data — please try again.",
    );
  }

  // Envelope-shape guard: results must be an array
  if (!Array.isArray(json.results)) {
    throw new CmsError(
      "cms_api_error",
      "CMS returned an error for claims data — please try again.",
    );
  }

  // Validate each row via ClaimsRowSchema.safeParse; drop invalid rows (graceful partial).
  // The route treats <4 rows as degraded metrics (not a throw) — D-10/SC#5.
  return json.results.flatMap((r) => {
    const p = ClaimsRowSchema.safeParse(r);
    return p.success ? [p.data] : [];
  });
}

/**
 * Fetches NATION and state-specific average rows from the CMS State/US Averages dataset
 * (xcdc-v8bm), filtered by state_or_nation. Returns both rows; throws if either is missing.
 *
 * Runs two parallel fetches — one for "NATION", one for the facility state (e.g. "FL").
 * The state is always the Zod-validated FacilityData.state from fetchFacility — never raw user input.
 *
 * SSRF discipline (T-05-V5-SSRF):
 *   - URL host+path from fixed constants (CMS_BASE_URL + DATASET_AVERAGES).
 *   - state/"NATION" are passed ONLY as conditions[0][value] — never concatenated into host/path.
 * Timeout: AbortSignal.timeout(8000) per fetch (T-05-V5-DOS).
 *
 * @param state - The 2-letter state code from the validated FacilityData.state (e.g. "FL").
 * @returns { nation: AveragesRow, state: AveragesRow }
 * @throws {CmsError} kind: network_error | cms_api_error
 */
export async function fetchAverages(
  state: string,
): Promise<{ nation: AveragesRow; state: AveragesRow }> {
  // Helper: fetch a single state_or_nation row from xcdc-v8bm.
  // stateOrNation goes ONLY into conditions[0][value] — SSRF discipline (T-05-V5-SSRF).
  async function fetchOneAveragesRow(
    stateOrNation: string,
  ): Promise<AveragesRow> {
    const url = new URL(`${CMS_BASE_URL}/${DATASET_AVERAGES}/0`);
    url.searchParams.set("conditions[0][property]", AVERAGES_FILTER_FIELD);
    url.searchParams.set("conditions[0][value]", stateOrNation); // ONLY here — not in path
    url.searchParams.set("conditions[0][operator]", "=");
    url.searchParams.set("limit", "1");

    let resp: Response;
    try {
      resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    } catch {
      throw new CmsError(
        "network_error",
        "State/national averages are unavailable — please try again.",
      );
    }

    if (!resp.ok) {
      throw new CmsError(
        "cms_api_error",
        "CMS returned an error for averages data — please try again.",
      );
    }

    let json: { count?: number; results?: unknown };
    try {
      json = (await resp.json()) as { count?: number; results?: unknown };
    } catch {
      throw new CmsError(
        "cms_api_error",
        "CMS returned an error for averages data — please try again.",
      );
    }

    if (!Array.isArray(json.results)) {
      throw new CmsError(
        "cms_api_error",
        "CMS returned an error for averages data — please try again.",
      );
    }

    // Zero rows → cms_api_error (the NATION / state row must exist in xcdc-v8bm)
    if (json.results.length === 0) {
      throw new CmsError(
        "cms_api_error",
        `CMS averages data for "${stateOrNation}" is unavailable.`,
      );
    }

    // Validate the first row via AveragesRowSchema (CLAUDE.md rule #4)
    const parseResult = AveragesRowSchema.safeParse(json.results[0]);
    if (!parseResult.success) {
      // D-06: log server-side only
      console.error(
        `[validation_error] averages state_or_nation="${stateOrNation}"`,
        z.prettifyError(parseResult.error),
      );
      throw new CmsError(
        "cms_api_error",
        "We couldn't read the averages data right now.",
      );
    }

    return parseResult.data;
  }

  // Run NATION + state fetches in parallel (both have independent 8s timeouts)
  const [nationRow, stateRow] = await Promise.all([
    fetchOneAveragesRow("NATION"),
    fetchOneAveragesRow(state),
  ]);

  return { nation: nationRow, state: stateRow };
}
