// error-presentation.ts — Exhaustive error-kind → {message, placement} mapping for the UI.
//
// D-07: inline = invalid_ccn, not_found (about the CCN value the user entered)
//        banner = network_error, cms_api_error, validation_error (system/transient/operator-alert)
// D-08: UI-authored friendly copy — overrides the server's default message.
//        validation_error uses NON-retry copy: it won't heal on retry — must NOT say "try again".
// D-09: Exhaustive switch + assertNever(error.kind) — adding a 6th kind without a case is a
//        TypeScript compile error (enforced by tsc --noEmit in npm run verify, ERR-02).
//
// T-03-02: Only UI-authored copy is interpolated; the only dynamic value is error.ccn,
//           which is an already-format-gated 6-char string (no CMS internals leak).
//
// No "use client" directive — pure lib module, safe on both client and server.

import { type CmsApiError, assertNever } from "@/lib/cms/errors";

/** Placement of the error in the UI (D-07). */
export type ErrorPlacement = "inline" | "banner";

/**
 * Maps a CmsApiError to a UI-friendly message and placement.
 *
 * D-07: inline errors are about the CCN value; banner errors are system/transient/operator.
 * D-08: per-kind copy is UI-authored (overrides server message). validation_error is non-retry.
 * D-09: assertNever(error.kind) at default — a 6th kind without a case is a compile error.
 *
 * @param error — A validated CmsApiError from the /api/facility response.
 * @returns { message, placement } for rendering in the UI.
 */
export function getErrorPresentation(error: CmsApiError): {
  message: string;
  placement: ErrorPlacement;
} {
  // Capture the discriminant before the switch so it's available in the default arm.
  // D-09 / RESEARCH Pitfall 4: pass the discriminant (error.kind), NOT the whole object (error).
  const kind = error.kind;
  switch (kind) {
    case "invalid_ccn":
      // Inline: the entered CCN value is malformed (LOOK-02 / D-07)
      return {
        message:
          "Please enter a valid 6-character CCN (letters and numbers only).",
        placement: "inline",
      };

    case "not_found":
      // Inline: valid format but no CMS record — echo the CCN (D-07 / T-03-02)
      return {
        message: `No facility found for CCN "${error.ccn}". Please verify and try again.`,
        placement: "inline",
      };

    case "network_error":
      // Banner: transient network issue — retry is appropriate
      return {
        message: "Could not reach CMS. Check your connection and try again.",
        placement: "banner",
      };

    case "cms_api_error":
      // Banner: CMS upstream error — retry may resolve it
      return {
        message:
          "CMS is temporarily unavailable. Please try again in a moment.",
        placement: "banner",
      };

    case "validation_error":
      // Banner: unexpected CMS response shape — NON-retry copy (D-08)
      // This will NOT heal on retry — must NOT suggest retrying.
      return {
        message:
          "Received an unexpected response from CMS. This issue has been noted.",
        placement: "banner",
      };

    default:
      // D-09 / T-03-03: Pass the discriminant (not the whole object) — see RESEARCH Pitfall 4.
      // If a 6th kind is added to CmsApiError without a case here, this is a compile error.
      return assertNever(kind);
  }
}
