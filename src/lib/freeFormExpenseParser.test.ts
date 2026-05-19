import { describe, expect, it } from "vitest";
import { parseStructuredExpenseText } from "./freeFormExpenseParser";

describe("parseStructuredExpenseText", () => {
  it("extracts amount, merchant, notes, payment/account/category hints from explicit segments", () => {
    const result = parseStructuredExpenseText({
      text: "30 rs at VC Cafe for varan vati via BOB UPI category food tags lunch, pune",
      now: new Date("2026-03-14T00:00:00Z"),
    });

    expect(result).toMatchObject({
      amount: 30,
      merchant: "VC Cafe",
      notes: "varan vati",
      paymentHint: "BOB UPI",
      accountHint: "BOB",
      categoryHint: "food",
      tags: ["lunch", "pune"],
      hasExplicitDate: false,
      date: "2026-03-14",
    });
  });

  it("merges hashtag tags with explicit tags", () => {
    const result = parseStructuredExpenseText({
      text: "₹425 at Starbucks for coffee tags snacks #weekend",
      now: new Date("2026-03-14T00:00:00Z"),
    });

    expect(result.tags).toEqual(["weekend", "snacks"]);
    expect(result.merchant).toBe("Starbucks");
    expect(result.notes).toBe("coffee");
  });

  it("strips payment noise from fallback merchant extraction", () => {
    const result = parseStructuredExpenseText({
      text: "dinner ₹350 cash",
      now: new Date("2026-03-14T00:00:00Z"),
    });

    expect(result.amount).toBe(350);
    expect(result.merchant).toBe("dinner");
    expect(result.paymentHint).toBe("cash");
  });

  it("parses explicit dates in free-form text", () => {
    const result = parseStructuredExpenseText({
      text: "2026-03-05 uber 480",
      now: new Date("2026-03-14T00:00:00Z"),
    });

    expect(result.amount).toBe(480);
    expect(result.date).toBe("2026-03-05");
    expect(result.hasExplicitDate).toBe(true);
    expect(result.merchant).toBe("uber");
  });

  it("parses strict key=value syntax", () => {
    const result = parseStructuredExpenseText({
      text: "amt=60; merchant=VC Cafe; notes=Poli Bhaji; account=BOB; payment=UPI; category=Food; tags=lunch,pune",
      now: new Date("2026-03-14T00:00:00Z"),
    });

    expect(result).toMatchObject({
      amount: 60,
      merchant: "VC Cafe",
      notes: "Poli Bhaji",
      accountHint: "BOB",
      paymentHint: "UPI",
      categoryHint: "Food",
      tags: ["lunch", "pune"],
      date: "2026-03-14",
    });
  });
});
