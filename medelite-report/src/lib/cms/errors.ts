// errors.ts — 5-kind error taxonomy for the CMS data layer (D-01/D-03/D-18).
//
// T-02-LEAK: validation_error carries NO extra field (D-05) — only kind+message —
// so CMS response detail never leaks to the client. The Phase 3 route enforces this
// at the API seam.
//
// T-02-EXH: assertNever turns an unhandled future kind into a TypeScript compile error
// in any switch that imports CmsApiError (D-03). Adding a 6th kind without a case
// causes a type error at the assertNever(e) default arm.
//
// Zod v4 idioms: result.error.issues (NOT .errors), z.prettifyError for human text.

import { z } from "zod";

/**
 * Discriminated union of all possible CMS API error kinds (D-01).
 * Exactly 5 kinds — adding a 6th triggers a compile error at any exhaustive switch
 * via assertNever (D-03).
 *
 * not_found carries an extra `ccn: string` so callers can echo the looked-up CCN.
 * validation_error carries NO extra field (D-05 — leak prevention; full Zod details
 * are server-side console.error only, never sent to the client).
 */
export const CmsApiErrorSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("invalid_ccn"), message: z.string() }),
  z.object({
    kind: z.literal("not_found"),
    message: z.string(),
    ccn: z.string(),
  }),
  z.object({ kind: z.literal("network_error"), message: z.string() }),
  z.object({ kind: z.literal("cms_api_error"), message: z.string() }),
  z.object({ kind: z.literal("validation_error"), message: z.string() }),
]);

/** Inferred TypeScript union from the schema (D-03 exhaustiveness). */
export type CmsApiError = z.infer<typeof CmsApiErrorSchema>;

/**
 * Exhaustiveness guard (D-03).
 *
 * Usage in a Phase 3 switch:
 *   switch (e.kind) {
 *     case 'invalid_ccn': ...
 *     ...
 *     default: return assertNever(e)  // compile error if new kind added without case
 *   }
 *
 * Throws at runtime to catch impossible branches that slip through at JS level.
 */
export function assertNever(x: never): never {
  throw new Error("Unhandled CmsError kind: " + JSON.stringify(x));
}

/**
 * Throwable error class for the CMS fetch pipeline (D-18).
 *
 * Enables `instanceof CmsError` catch in route handlers so unrelated errors
 * (e.g. unexpected JS exceptions) are not silently swallowed.
 *
 * @example
 *   throw new CmsError('not_found', 'Facility not found', { ccn })
 *   // catch (e) { if (e instanceof CmsError) { ... } }
 */
export class CmsError extends Error {
  constructor(
    public readonly kind: CmsApiError["kind"],
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "CmsError";
    // Restore correct prototype chain for instanceof checks across transpilation targets
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
