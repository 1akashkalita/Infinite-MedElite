// route.ts — GET /api/facility?ccn=<CCN>
//
// Thin route handler: CCN gate → fetchFacility pipeline → exhaustive CmsError→HTTP mapping.
// Non-dynamic route: CCN comes from query string (?ccn=), NOT from ctx.params.
// (ctx.params would only exist for /api/facility/[ccn]/route.ts — this is not that.)
//
// Security:
//   T-02-CCN: trim + uppercase-normalize + /^[A-Za-z0-9]{6}$/ gate before any fetch (D-22/D-07)
//   T-02-LEAK: validation_error body is ONLY { kind, message } — no ccn, no Zod internals (D-05)
//
// NJS16 notes (AGENTS.md / route.md):
//   - Read CCN from request.nextUrl.searchParams.get('ccn') — NOT ctx.params
//   - Response.json(body, { status }) — web-standard, no import needed
//   - export const runtime = 'nodejs' — D-25, future-proofs for react-pdf

import type { NextRequest } from "next/server";
import { fetchFacility } from "@/lib/cms/client";
import { CmsError, assertNever } from "@/lib/cms/errors";

// D-25: explicit Node.js runtime — required for routes that will later import @react-pdf/renderer
export const runtime = "nodejs";

/**
 * GET /api/facility?ccn=<CCN>
 *
 * Returns 200 with { data: FacilityData } on success.
 * Returns an error envelope { error: { kind, message, ...extra } } on failure (D-02).
 *
 * HTTP status mapping (D-01):
 *   400  invalid_ccn      — CCN missing/malformed (before any fetch)
 *   404  not_found        — valid format, no CMS row found; body includes echoed ccn (D-07)
 *   502  network_error    — upstream CMS timeout or network failure
 *   502  cms_api_error    — CMS returned non-200
 *   502  validation_error — CMS row failed Zod validation; NO Zod internals in body (D-05)
 */
export async function GET(request: NextRequest) {
  // 1. Read raw CCN from query string (non-dynamic route — no ctx.params)
  const raw = request.nextUrl.searchParams.get("ccn");

  // 2. Missing/null param → immediate 400
  if (raw === null) {
    return Response.json(
      {
        error: {
          kind: "invalid_ccn",
          message: "CCN must be exactly 6 alphanumeric characters.",
        },
      },
      { status: 400 },
    );
  }

  // 3. Normalize: trim whitespace + uppercase (D-22/D-07)
  //    Cap-then-reflect: length-cap ensures we only echo a short safe string (D-07)
  const ccn = raw.trim().toUpperCase().slice(0, 20); // max 20 chars before gate

  // 4. Format gate — /^[A-Za-z0-9]{6}$/ (D-22: NOT ^\d{6}$ — alphanumeric state codes exist)
  if (!/^[A-Za-z0-9]{6}$/.test(ccn)) {
    return Response.json(
      {
        error: {
          kind: "invalid_ccn",
          message: "CCN must be exactly 6 alphanumeric characters.",
        },
      },
      { status: 400 },
    );
  }

  // 5. Full pipeline: fetch + validate + map (may throw CmsError)
  try {
    const facility = await fetchFacility(ccn);
    return Response.json({ data: facility }, { status: 200 });
  } catch (err) {
    // Re-throw non-CmsError (unexpected JS exceptions — don't silently swallow)
    if (!(err instanceof CmsError)) throw err;

    // Exhaustive switch — assertNever at default gives a compile error if a 6th kind is added
    // without a corresponding case (D-03 exhaustiveness).
    switch (err.kind) {
      case "invalid_ccn":
        return Response.json(
          { error: { kind: err.kind, message: err.message } },
          { status: 400 },
        );

      case "not_found":
        // D-07: echo the normalized, format-passed CCN (not raw user input)
        return Response.json(
          { error: { kind: err.kind, message: err.message, ccn } },
          { status: 404 },
        );

      case "network_error":
        return Response.json(
          { error: { kind: err.kind, message: err.message } },
          { status: 502 },
        );

      case "cms_api_error":
        return Response.json(
          { error: { kind: err.kind, message: err.message } },
          { status: 502 },
        );

      case "validation_error":
        // ⚠ D-05 T-02-LEAK: ONLY { kind, message } — NO ccn, NO extra, NO Zod internals
        // The console.error with CCN + prettified Zod issues is done in client.ts (D-06)
        return Response.json(
          { error: { kind: err.kind, message: err.message } },
          { status: 502 },
        );

      default:
        // err is a CmsError instance (a class), so the switch narrows err.kind — not err
        // itself — to `never` here. Pass the discriminant: if a 6th kind is ever added to
        // CmsApiError without a case above, err.kind stops narrowing to never and this
        // line fails to compile (D-03 exhaustiveness preserved).
        return assertNever(err.kind);
    }
  }
}
