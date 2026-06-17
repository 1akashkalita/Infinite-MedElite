// constants.ts — centralized CMS API constants (D-24).
//
// All three constants are traced to tests/fixtures/provider-686123.json and
// scripts/capture-fixture.ts (CLAUDE.md rule #3: no CMS field names from memory).
//
// T-02-SSRF containment: the host+path originate ONLY from these constants.
// The CCN is passed as a query-condition VALUE, never concatenated into the URL
// host or path (enforced in client.ts, Plan 02-02).

/**
 * CMS Provider Data Catalog API query endpoint.
 * Verified in scripts/capture-fixture.ts (BASE const).
 */
export const CMS_BASE_URL =
  "https://data.cms.gov/provider-data/api/1/datastore/query";

/**
 * Provider Information dataset ID.
 * Verified against CMS metastore in scripts/capture-fixture.ts REGISTRY and
 * confirmed by tests/fixtures/provider-686123.json (captured from this dataset).
 */
export const DATASET_PROVIDER_INFO = "4pq5-n9py";

/**
 * The CCN filter field name in dataset 4pq5-n9py.
 * Verified in tests/fixtures/provider-686123.json (top-level key) and
 * scripts/capture-fixture.ts REGISTRY filter property.
 * NOT `federal_provider_number` (ARCHITECTURE.md used that from memory — do NOT use it).
 */
export const CCN_FILTER_FIELD = "cms_certification_number_ccn";
