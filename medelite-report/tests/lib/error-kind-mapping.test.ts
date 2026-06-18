// error-kind-mapping.test.ts — tests for the exhaustive error-kind → message/placement mapping.
//
// Covers LOOK-03 (all 5 error kinds handled), ERR-01 (inline/banner placement), ERR-02 (compile-time
// exhaustiveness via assertNever — enforced by tsc --noEmit in npm run verify).
//
// D-07: inline = invalid_ccn, not_found; banner = network_error, cms_api_error, validation_error
// D-08: validation_error uses NON-retry copy (won't heal on retry — must not say "try again")
// D-09: assertNever(error.kind) at default — adding a 6th kind is a compile error

import { describe, expect, it } from "vitest";
import type { CmsApiError } from "@/lib/cms/errors";
import { getErrorPresentation } from "@/lib/ui/error-presentation";

describe("getErrorPresentation — inline errors (D-07)", () => {
  it("maps invalid_ccn to inline placement with a non-empty message", () => {
    const error: CmsApiError = {
      kind: "invalid_ccn",
      message: "server message (overridden by UI copy)",
    };
    const result = getErrorPresentation(error);
    expect(result.placement).toBe("inline");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("maps not_found to inline placement and echoes the CCN in the message (D-07)", () => {
    const error: CmsApiError = {
      kind: "not_found",
      message: "server message",
      ccn: "686123",
    };
    const result = getErrorPresentation(error);
    expect(result.placement).toBe("inline");
    expect(result.message).toContain("686123");
  });
});

describe("getErrorPresentation — banner errors (D-07)", () => {
  it("maps network_error to banner placement", () => {
    const error: CmsApiError = { kind: "network_error", message: "timeout" };
    const result = getErrorPresentation(error);
    expect(result.placement).toBe("banner");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("maps cms_api_error to banner placement", () => {
    const error: CmsApiError = {
      kind: "cms_api_error",
      message: "upstream error",
    };
    const result = getErrorPresentation(error);
    expect(result.placement).toBe("banner");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("maps validation_error to banner placement with non-retry copy (D-08)", () => {
    const error: CmsApiError = {
      kind: "validation_error",
      message: "Zod validation failed",
    };
    const result = getErrorPresentation(error);
    expect(result.placement).toBe("banner");
    expect(result.message.length).toBeGreaterThan(0);
    // D-08: validation_error must NOT say "try again" — it won't heal on retry
    expect(result.message).not.toMatch(/try again/i);
  });
});

describe("getErrorPresentation — message distinctness (LOOK-03)", () => {
  it("invalid_ccn and not_found messages are distinct strings", () => {
    const invalidCcnMsg = getErrorPresentation({
      kind: "invalid_ccn",
      message: "server message",
    }).message;
    const notFoundMsg = getErrorPresentation({
      kind: "not_found",
      message: "server message",
      ccn: "686123",
    }).message;
    expect(invalidCcnMsg).not.toBe(notFoundMsg);
  });
});
