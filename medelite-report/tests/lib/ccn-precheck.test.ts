// ccn-precheck.test.ts — tests for the client-side CCN format pre-check (LOOK-02 / D-05).
//
// The client check mirrors the server gate in src/app/api/facility/route.ts (lines 55–58):
//   const ccn = raw.trim().toUpperCase().slice(0, 20);
//   if (!/^[A-Za-z0-9]{6}$/.test(ccn)) { ... }
//
// D-05: this is a UX-only pre-check — the server route is the authoritative gate.

import { describe, expect, it } from "vitest";
import { isValidCcnFormat, normalizeCcn } from "@/lib/ui/ccn";

describe("isValidCcnFormat", () => {
  it("returns true for a standard 6-digit numeric CCN", () => {
    expect(isValidCcnFormat("686123")).toBe(true);
  });

  it("returns true for a 6-char alphanumeric CCN (state code)", () => {
    expect(isValidCcnFormat("AB1234")).toBe(true);
  });

  it("returns false for a 5-char CCN (too short)", () => {
    expect(isValidCcnFormat("12345")).toBe(false);
  });

  it("returns false for a 7-char CCN (too long)", () => {
    expect(isValidCcnFormat("1234567")).toBe(false);
  });

  it("returns false for a CCN with a special character", () => {
    expect(isValidCcnFormat("6861!3")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isValidCcnFormat("")).toBe(false);
  });

  it("returns false for a CCN with a space", () => {
    expect(isValidCcnFormat("686 23")).toBe(false);
  });
});

describe("normalizeCcn", () => {
  it("trims leading and trailing whitespace", () => {
    expect(normalizeCcn("  686123  ")).toBe("686123");
  });

  it("uppercases lowercase letters", () => {
    expect(normalizeCcn("ab1234")).toBe("AB1234");
  });

  it("round-trips a clean CCN unchanged", () => {
    expect(normalizeCcn("686123")).toBe("686123");
  });

  it("trims AND uppercases in one call", () => {
    expect(normalizeCcn("  ab1234  ")).toBe("AB1234");
  });
});
