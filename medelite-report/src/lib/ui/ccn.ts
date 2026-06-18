// ccn.ts — Pure CCN normalize + format-check functions for the client UI (LOOK-02 / D-05).
//
// These functions mirror the canonical server gate in src/app/api/facility/route.ts (lines 55–58):
//   const ccn = raw.trim().toUpperCase().slice(0, 20);
//   if (!/^[A-Za-z0-9]{6}$/.test(ccn)) { ... }
//
// D-05: The client pre-check is UX-only — the server route stays the authoritative gate.
//       This saves a round-trip for obviously malformed input but NEVER replaces server validation.
//
// No "use client" directive — this is a pure lib module, safe on both client and server.

/** The canonical CCN format regex — mirrors the server gate in route.ts line 58. */
const CCN_REGEX = /^[A-Za-z0-9]{6}$/;

/**
 * Normalizes a raw CCN string for comparison: trim whitespace + uppercase.
 * Mirrors the server normalization in route.ts line 55:
 *   `raw.trim().toUpperCase().slice(0, 20)`
 * (The length cap is not needed here because isValidCcnFormat enforces exactly 6 chars.)
 *
 * @param raw — Raw CCN input from the user.
 * @returns Trimmed, uppercased CCN string.
 */
export function normalizeCcn(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Checks whether a CCN string matches the canonical format: exactly 6 alphanumeric chars.
 * The check runs on the already-normalized value (trim + uppercase already applied).
 *
 * D-05: Mirrors `/^[A-Za-z0-9]{6}$/` from route.ts line 58.
 * Alphanumeric state codes (e.g. "AB1234") are valid — do NOT use /^\d{6}$/ (STACK.md).
 *
 * @param ccn — The CCN to validate (should already be normalized via normalizeCcn).
 * @returns true if valid format, false otherwise.
 */
export function isValidCcnFormat(ccn: string): boolean {
  return CCN_REGEX.test(ccn);
}
