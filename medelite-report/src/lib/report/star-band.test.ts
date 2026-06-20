// star-band.test.ts — unit tests for getStarBand() and buildStarGlyphs()
// Vitest node env — no DOM/jsdom required.

import { describe, it, expect } from "vitest";
import { getStarBand, buildStarGlyphs } from "./star-band";

describe("getStarBand", () => {
  it("returns 'green' for rating 5", () => {
    expect(getStarBand(5)).toBe("green");
  });

  it("returns 'green' for rating 4", () => {
    expect(getStarBand(4)).toBe("green");
  });

  it("returns 'amber' for rating 3", () => {
    expect(getStarBand(3)).toBe("amber");
  });

  it("returns 'red' for rating 2", () => {
    expect(getStarBand(2)).toBe("red");
  });

  it("returns 'red' for rating 1", () => {
    expect(getStarBand(1)).toBe("red");
  });

  it("returns 'grey' for null (suppressed/absent rating) — D-06", () => {
    expect(getStarBand(null)).toBe("grey");
  });

  it("uses === null check: does NOT treat 0 as null (0 is valid data even if not a valid CMS rating)", () => {
    // 0 is not null — it falls through to "red" (< 4, !== 3)
    expect(getStarBand(0)).toBe("red");
  });
});

describe("buildStarGlyphs", () => {
  it("builds 4 filled + 1 outline for rating 4", () => {
    expect(buildStarGlyphs(4)).toBe("★★★★☆");
  });

  it("builds 1 filled + 4 outline for rating 1", () => {
    expect(buildStarGlyphs(1)).toBe("★☆☆☆☆");
  });

  it("builds 5 filled + 0 outline for rating 5", () => {
    expect(buildStarGlyphs(5)).toBe("★★★★★");
  });

  it("builds 3 filled + 2 outline for rating 3", () => {
    expect(buildStarGlyphs(3)).toBe("★★★☆☆");
  });

  it("builds 2 filled + 3 outline for rating 2", () => {
    expect(buildStarGlyphs(2)).toBe("★★☆☆☆");
  });

  it("always returns exactly 5 characters", () => {
    for (let r = 1; r <= 5; r++) {
      expect([...buildStarGlyphs(r)].length).toBe(5);
    }
  });
});
