import { describe, expect, it, vi, afterEach } from "vitest";
import {
  fetchFacility,
  fetchClaimsMeasures,
  fetchAverages,
} from "@/lib/cms/client";
import providerFixture from "../../fixtures/provider-686123.json";
import claimsFixture from "../../fixtures/claims-686123.json";
import averagesFixture from "../../fixtures/averages-xcdc.json";

// Tests for fetchFacility — the full CMS fetch+timeout+validate+map pipeline.
// Uses vi.stubGlobal('fetch', ...) to stub global fetch; restored after each test.
// Covers all 5 error paths (D-01/D-18/D-19) and the D-06 server-side logging requirement.

afterEach(() => vi.unstubAllGlobals());

describe("fetchFacility", () => {
  // Happy path: returns FacilityData with correct providerName and qualityCare
  it("returns FacilityData for a valid CMS response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ count: 1, results: [providerFixture[0]] }),
            { status: 200 },
          ),
        ),
    );
    const facility = await fetchFacility("686123");
    expect(facility.providerName).toBe(
      "KENDALL LAKES HEALTHCARE AND REHAB CENTER",
    );
    expect(facility.starRatings.qualityCare).toBe(5);
    expect(facility.ccn).toBe("686123");
  });

  // D-19: Aborted fetch → network_error (AbortSignal.timeout fires)
  it("throws CmsError network_error when fetch is aborted", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new DOMException("The operation was aborted.", "AbortError"),
        ),
    );
    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "network_error",
    });
  });

  // D-19: Any network-level throw → network_error (network unreachable, ECONNREFUSED, etc.)
  it("throws CmsError network_error on generic network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "network_error",
    });
  });

  // D-18: Non-200 CMS response → cms_api_error
  it("throws CmsError cms_api_error when CMS returns non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("Internal Server Error", { status: 500 }),
        ),
    );
    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "cms_api_error",
    });
  });

  // CR-01: 200 with a non-JSON body (maintenance page, truncated stream) → cms_api_error,
  // NOT a raw SyntaxError that would escape to a bare 500.
  it("throws CmsError cms_api_error when CMS returns a 200 with a non-JSON body", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("<html>maintenance</html>", { status: 200 }),
        ),
    );
    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "cms_api_error",
    });
  });

  // CR-02: 200 with a changed envelope shape (results not an array) → cms_api_error,
  // NOT a raw TypeError on .length.
  it("throws CmsError cms_api_error when the CMS envelope shape is wrong", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ count: 1, data: [] }), { status: 200 }),
        ),
    );
    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "cms_api_error",
    });
  });

  // D-01: Zero rows → not_found with the CCN in extra
  it("throws CmsError not_found when CMS returns zero results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ count: 0, results: [] }), {
          status: 200,
        }),
      ),
    );
    await expect(fetchFacility("000000")).rejects.toMatchObject({
      kind: "not_found",
    });
  });

  // D-05/D-06: Malformed row → validation_error thrown + console.error called with CCN
  it("throws CmsError validation_error for malformed CMS row and logs to console.error", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ count: 1, results: [{ broken: true }] }),
            { status: 200 },
          ),
        ),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(fetchFacility("686123")).rejects.toMatchObject({
      kind: "validation_error",
    });

    // D-06: server-side logging must include the CCN
    expect(errorSpy).toHaveBeenCalled();
    const logArgs = errorSpy.mock.calls[0].join(" ");
    expect(logArgs).toContain("686123");

    errorSpy.mockRestore();
  });

  // D-04: validation_error message is honest non-retry copy (no "please try again")
  it("validation_error message is honest non-retry copy", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ count: 1, results: [{ broken: true }] }),
            { status: 200 },
          ),
        ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    let thrownErr: unknown;
    try {
      await fetchFacility("686123");
    } catch (e) {
      thrownErr = e;
    }

    expect(thrownErr).toMatchObject({ kind: "validation_error" });
    const msg = (thrownErr as { message: string }).message;
    // honest non-retry message — should NOT say "try again"
    expect(msg.toLowerCase()).not.toContain("try again");
  });

  // D-05: thrown validation_error CmsError has no extra field (no Zod internals)
  it("validation_error CmsError carries no extra field (D-05 leak prevention)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ count: 1, results: [{ broken: true }] }),
            { status: 200 },
          ),
        ),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    let thrownErr: unknown;
    try {
      await fetchFacility("686123");
    } catch (e) {
      thrownErr = e;
    }

    expect(thrownErr).toMatchObject({ kind: "validation_error" });
    // No extra field — D-05 invariant
    expect((thrownErr as { extra?: unknown }).extra).toBeUndefined();
  });

  // CMS condition operator must be single '=' (not '==')
  it("constructs CMS URL with single '=' operator (not '==')", async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        return Promise.resolve(
          new Response(
            JSON.stringify({ count: 1, results: [providerFixture[0]] }),
            { status: 200 },
          ),
        );
      }),
    );

    await fetchFacility("686123");

    expect(capturedUrls.length).toBeGreaterThan(0);
    const url = capturedUrls[0];
    // Operator must be encoded '=' (as %3D) — NOT '==' (which would be %3D%3D)
    // URL.searchParams.set encodes '=' to '%3D'
    expect(url).toContain("%3D");
    expect(url).not.toContain("%3D%3D");
  });
});

// =============================================================================
// fetchClaimsMeasures — new sibling fetcher (Phase 05-02)
// =============================================================================
// Mirrors fetchFacility discipline: SSRF/timeout/Zod. Returns ClaimsRow[] (may be empty).
// Filters by CCN (conditions[0][property]=cms_certification_number_ccn).
// Drops invalid rows via flatMap safeParse (graceful partial).
// Never throws on empty results — only throws CmsError on network/API failure.
// =============================================================================

describe("fetchClaimsMeasures", () => {
  // Happy path: returns 4 validated ClaimsRow objects for the 686123 fixture
  it("returns 4 validated ClaimsRow objects for the 686123 fixture", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ count: 4, results: claimsFixture }), {
          status: 200,
        }),
      ),
    );
    const rows = await fetchClaimsMeasures("686123");
    expect(rows).toHaveLength(4);
    // All 4 measure codes present
    const codes = rows.map((r) => r.measure_code).sort();
    expect(codes).toEqual(["521", "522", "551", "552"]);
    // CCN preserved as string
    expect(rows[0]!.cms_certification_number_ccn).toBe("686123");
  });

  // Invalid row dropped (graceful partial via flatMap safeParse)
  it("drops an invalid row and returns only the valid rows", async () => {
    const mixedResults = [claimsFixture[0], { broken: true }, claimsFixture[1]];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ count: 3, results: mixedResults }), {
          status: 200,
        }),
      ),
    );
    const rows = await fetchClaimsMeasures("686123");
    // The broken row is dropped; 2 valid rows returned
    expect(rows).toHaveLength(2);
    expect(rows[0]!.measure_code).toBe("521");
    expect(rows[1]!.measure_code).toBe("522");
  });

  // Empty results → returns [] (not a throw)
  it("returns empty array for zero results (route treats <4 as degraded, never a throw)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ count: 0, results: [] }), {
          status: 200,
        }),
      ),
    );
    const rows = await fetchClaimsMeasures("686123");
    expect(rows).toEqual([]);
  });

  // Network failure → CmsError("network_error")
  it("throws CmsError network_error on fetch reject", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(fetchClaimsMeasures("686123")).rejects.toMatchObject({
      kind: "network_error",
    });
  });

  // Non-200 response → CmsError("cms_api_error")
  it("throws CmsError cms_api_error when CMS returns non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Server Error", { status: 500 })),
    );
    await expect(fetchClaimsMeasures("686123")).rejects.toMatchObject({
      kind: "cms_api_error",
    });
  });

  // Non-array results → CmsError("cms_api_error")
  it("throws CmsError cms_api_error when results is not an array", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ count: 0, data: [] }), { status: 200 }),
        ),
    );
    await expect(fetchClaimsMeasures("686123")).rejects.toMatchObject({
      kind: "cms_api_error",
    });
  });

  // SSRF discipline: CCN goes only into conditions[0][value], never into host/path
  it("builds URL from fixed constants; CCN only in conditions[0][value] (SSRF discipline)", async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        return Promise.resolve(
          new Response(JSON.stringify({ count: 4, results: claimsFixture }), {
            status: 200,
          }),
        );
      }),
    );
    await fetchClaimsMeasures("686123");
    expect(capturedUrls.length).toBeGreaterThan(0);
    const url = capturedUrls[0]!;
    // Host+path from fixed constants — CCN must NOT appear in the path
    expect(url).toContain("data.cms.gov");
    expect(url).toContain("ijh5-nb2v");
    // CCN appears only as a query parameter value (percent-encoded)
    expect(url).not.toContain("/686123");
    // Confirm AbortSignal.timeout is used — indirectly confirmed by the fetch behavior
  });

  // AbortError timeout → CmsError("network_error")
  it("throws CmsError network_error on AbortError (timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new DOMException("The operation was aborted.", "AbortError"),
        ),
    );
    await expect(fetchClaimsMeasures("686123")).rejects.toMatchObject({
      kind: "network_error",
    });
  });
});

// =============================================================================
// fetchAverages — new sibling fetcher (Phase 05-02)
// =============================================================================
// Returns { nation: AveragesRow, state: AveragesRow } keyed by AVERAGES_FILTER_FIELD.
// Makes two parallel fetches (NATION + state). Does NOT use the CCN filter.
// SSRF discipline: state goes only into conditions[0][value], not the URL host/path.
// =============================================================================

describe("fetchAverages", () => {
  // Happy path: returns { nation, state } with the validated rows
  it("returns { nation, state } AveragesRow for the 686123/FL fixture", async () => {
    // Stub fetch to return the appropriate fixture row depending on which state_or_nation is requested
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        // Two fetches: one for NATION, one for FL
        const isNation = url.includes("NATION");
        const row = isNation ? averagesFixture.NATION : averagesFixture.FL;
        return Promise.resolve(
          new Response(JSON.stringify({ count: 1, results: [row] }), {
            status: 200,
          }),
        );
      }),
    );
    const result = await fetchAverages("FL");
    expect(result.nation.state_or_nation).toBe("NATION");
    expect(result.state.state_or_nation).toBe("FL");
  });

  // Correct filter field used: AVERAGES_FILTER_FIELD (state_or_nation), NOT CCN
  it("uses AVERAGES_FILTER_FIELD (state_or_nation) — no CCN filter in averages URL", async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        const isNation = url.includes("NATION");
        const row = isNation ? averagesFixture.NATION : averagesFixture.FL;
        return Promise.resolve(
          new Response(JSON.stringify({ count: 1, results: [row] }), {
            status: 200,
          }),
        );
      }),
    );
    await fetchAverages("FL");
    expect(capturedUrls.length).toBeGreaterThan(0);
    for (const url of capturedUrls) {
      expect(url).toContain("state_or_nation");
      // CCN filter field must NOT appear in averages requests
      expect(url).not.toContain("cms_certification_number_ccn");
    }
  });

  // SSRF discipline: state goes only into conditions[0][value], not the URL path
  it("state only in conditions[0][value] — not concatenated into host/path (SSRF discipline)", async () => {
    const capturedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        capturedUrls.push(url);
        const isNation = url.includes("NATION");
        const row = isNation ? averagesFixture.NATION : averagesFixture.FL;
        return Promise.resolve(
          new Response(JSON.stringify({ count: 1, results: [row] }), {
            status: 200,
          }),
        );
      }),
    );
    await fetchAverages("FL");
    for (const url of capturedUrls) {
      // xcdc-v8bm must appear in the URL path (fixed constant)
      expect(url).toContain("xcdc-v8bm");
      // The state ("FL" or "NATION") goes into the query string, not into the path
      // Path has a fixed structure: /datastore/query/xcdc-v8bm/0
      expect(url).not.toMatch(/xcdc-v8bm\/FL/);
      expect(url).not.toMatch(/xcdc-v8bm\/NATION/);
    }
  });

  // Network failure → CmsError("network_error")
  it("throws CmsError network_error on fetch reject", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("fetch failed")),
    );
    await expect(fetchAverages("FL")).rejects.toMatchObject({
      kind: "network_error",
    });
  });

  // Non-200 → CmsError("cms_api_error")
  it("throws CmsError cms_api_error when CMS returns non-200", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("Server Error", { status: 500 })),
    );
    await expect(fetchAverages("FL")).rejects.toMatchObject({
      kind: "cms_api_error",
    });
  });

  // Missing/invalid row → CmsError("cms_api_error")
  it("throws CmsError cms_api_error when NATION row is missing (zero results)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ count: 0, results: [] }), {
          status: 200,
        }),
      ),
    );
    await expect(fetchAverages("FL")).rejects.toMatchObject({
      kind: "cms_api_error",
    });
  });

  // AbortError timeout → CmsError("network_error")
  it("throws CmsError network_error on AbortError (timeout)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockRejectedValue(
          new DOMException("The operation was aborted.", "AbortError"),
        ),
    );
    await expect(fetchAverages("FL")).rejects.toMatchObject({
      kind: "network_error",
    });
  });
});
