import { describe, expect, it } from "vitest";
import { CMSRowSchema } from "@/lib/cms/schema";

// Env-gated LIVE contract smoke test.
//
// Skipped by default so `npm run verify` / CI never touches the network — live CMS
// access is confined to opt-in runs (D-11). This proves the live Provider Information
// API still returns a CCN 686123 row that CMSRowSchema accepts, catching upstream
// schema drift (renamed columns, changed encodings) that committed fixtures cannot.
//
// Run it explicitly:  RUN_LIVE_CMS=1 npx vitest run tests/cms.live.test.ts
const LIVE = Boolean(process.env.RUN_LIVE_CMS);

const PROVIDER_DATASET = "4pq5-n9py";
const BASE = "https://data.cms.gov/provider-data/api/1/datastore/query";

describe.skipIf(!LIVE)("CMS Provider Information API (live contract)", () => {
  it("returns a CCN 686123 row that CMSRowSchema still accepts", async () => {
    const url = new URL(`${BASE}/${PROVIDER_DATASET}/0`);
    url.searchParams.set(
      "conditions[0][property]",
      "cms_certification_number_ccn",
    );
    url.searchParams.set("conditions[0][value]", "686123");
    // Single "=" operator — "==" returns HTTP 400 (mirrors capture-fixture.ts).
    url.searchParams.set("conditions[0][operator]", "=");

    const res = await fetch(url.toString());
    expect(res.ok).toBe(true);

    const json = (await res.json()) as { results: unknown[]; count: number };
    expect(json.count).toBeGreaterThan(0);
    expect(json.results.length).toBeGreaterThan(0);

    const parsed = CMSRowSchema.safeParse(json.results[0]);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.cms_certification_number_ccn).toBe("686123");
    }
  }, 30_000);
});
