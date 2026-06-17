import { describe, expect, it } from "vitest";
import { parseCMSRow, safeParseCMSRow } from "@/lib/cms/parse";
import providerFixture from "../../fixtures/provider-686123.json";

// WR-01: parse.ts is the Phase 2 route-handler entry point; its throw path and
// structured-error path are exercised here so every error path is tested (CLAUDE.md rule #6).

describe("parseCMSRow / safeParseCMSRow", () => {
  it("parseCMSRow returns a typed ParsedProvider for the captured fixture", () => {
    const parsed = parseCMSRow(providerFixture[0]);
    expect(parsed.cms_certification_number_ccn).toBe("686123");
    expect(parsed.state).toBe("FL");
  });

  it("parseCMSRow throws on invalid input (missing required keys / wrong shape)", () => {
    expect(() => parseCMSRow({ error: "invalid_ccn" })).toThrow();
  });

  it("parseCMSRow throw message is a non-empty human-readable string (z.prettifyError)", () => {
    let message = "";
    try {
      parseCMSRow({ error: "invalid_ccn" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message.length).toBeGreaterThan(0);
  });

  it("safeParseCMSRow returns success=false with issues on invalid input", () => {
    const result = safeParseCMSRow({ error: "invalid_ccn" });
    expect(result.success).toBe(false);
    if (!result.success) {
      // Zod v4: issues (NOT v3 .errors)
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("safeParseCMSRow returns success=true with typed data for the fixture", () => {
    const result = safeParseCMSRow(providerFixture[0]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cms_certification_number_ccn).toBe("686123");
    }
  });
});
