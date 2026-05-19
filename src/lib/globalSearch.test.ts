import { describe, expect, it } from "vitest";
import {
  normalizeSearchText,
  scoreSearchMatch,
  tokenizeSearchText,
} from "./globalSearch";

describe("globalSearch helpers", () => {
  it("normalizes casing and whitespace", () => {
    expect(normalizeSearchText("  Axis   MaxLife  ")).toBe("axis maxlife");
    expect(tokenizeSearchText("  Axis   MaxLife  ")).toEqual(["axis", "maxlife"]);
  });

  it("scores exact and prefix matches above broad field matches", () => {
    const exact = scoreSearchMatch({
      query: "rent",
      primaryText: "Rent",
      aliasTexts: ["Apartment"],
    });
    const prefix = scoreSearchMatch({
      query: "ren",
      primaryText: "Rent",
      aliasTexts: ["Apartment"],
    });
    const broad = scoreSearchMatch({
      query: "apartment",
      primaryText: "Rent",
      aliasTexts: ["Apartment"],
    });

    expect(exact).toBeTypeOf("number");
    expect(prefix).toBeTypeOf("number");
    expect(broad).toBeTypeOf("number");
    expect((exact ?? 0) > (prefix ?? 0)).toBe(true);
    expect((prefix ?? 0) > (broad ?? 0)).toBe(true);
  });

  it("matches multi-word queries across different fields", () => {
    const score = scoreSearchMatch({
      query: "axis insurance",
      primaryText: "Axis MaxLife term insurance",
      aliasTexts: ["Health", "BOB Savings 9965"],
      valueTexts: ["1198"],
    });

    expect(score).not.toBeNull();
  });

  it("rejects queries with missing tokens", () => {
    const score = scoreSearchMatch({
      query: "axis netflix",
      primaryText: "Axis MaxLife term insurance",
      aliasTexts: ["Health", "BOB Savings 9965"],
    });

    expect(score).toBeNull();
  });
});
