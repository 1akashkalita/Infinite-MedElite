# Infinite

Infinite is a lightweight web app that turns a single facility identifier into a polished, downloadable assessment report. Enter a nursing home's CCN (CMS Certification Number); the app pulls public CMS Care Compare data (location, star ratings, metadata, and claims-based hospitalization/ED measures), combines it with manual operational inputs, lets you preview the result live, and exports a clean, print-ready PDF and `.docx` with a clickable link back to the official Medicare Care Compare profile.

Built for Medelite as a take-home internship project. Deployed at: **https://infinite-snapshot.vercel.app**

## Getting Started

```bash
cd medelite-report
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Quality gate** (run before every commit):

```bash
npm run verify        # typecheck → lint → format:check → test
npm run verify:full   # verify + next build
```

## Data & presentation decisions

### Reference governs layout/labels; live CMS API governs values

The Kendall Lakes reference report (PDF/DOCX) defines the body field **order** and **label strings** (verbatim). It does **not** define the data — its 120 beds / "5280 SW 157th Ave" are illustrative. Real values come from the live CMS Provider Data Catalog API and the captured fixture for CCN 686123 (e.g. 150 certified beds). Do not "correct" live values to match the reference PDF.

### Address formatting: raw CMS pass-through (decision)

The reference renders "5280 SW 157th Ave, Miami, FL" (title case, ordinal suffix, abbreviated street type). The CMS API returns `provider_address = "5280 SW 157 AVENUE"`, `citytown = "MIAMI"`, `state = "FL"`.

We **display the composed CMS string verbatim**: `"5280 SW 157 AVENUE, MIAMI, FL"` (street + city + state, no ZIP) and intentionally do **not** normalize to the reference's title-case / ordinal ("157" → "157th") / abbreviation ("AVENUE" → "Ave").

**Rationale:** The address is a value (governed by the API, not the reference layout), and reconstructing the reference's presentation from raw CMS strings is lossy and risks corrupting regulated source data (CLAUDE.md data-integrity rule #3). This decision is reversible if a normalized presentation is later preferred.
