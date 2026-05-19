import { describe, expect, it } from "vitest";
import { parseTelegramMessage } from "./parser";

const categories = [
  { id: "cat-food", name: "Food & Dining", type: "expense" },
  { id: "cat-travel", name: "Travel", type: "expense" },
  { id: "cat-salary", name: "Salary", type: "income" },
  { id: "cat-refund", name: "Refund", type: "income" },
];

const paymentMethods = [
  { id: "pm-upi", name: "UPI" },
  { id: "pm-card", name: "Credit Card" },
  { id: "pm-cash", name: "Cash" },
  { id: "pm-bank", name: "Bank Transfer" },
];

const accounts = [
  { id: "acct-bob", name: "Bank of Baroda Savings Account" },
  { id: "acct-icici", name: "ICICI Amazon Pay Credit Card" },
  { id: "acct-hdfc", name: "HDFC Salary Account" },
];

describe("parseTelegramMessage", () => {
  it("extracts structured expense fields from an explicit free-form message", () => {
    const result = parseTelegramMessage({
      text: "rs 60 at VC Cafe for Poli Bhaji via BOB UPI category Food tags lunch, pune",
      categories,
      paymentMethods,
      accounts,
      now: new Date("2026-03-13T00:00:00Z"),
    });

    expect(result).toMatchObject({
      amount: 60,
      merchant: "VC Cafe",
      notes: "Poli Bhaji",
      categoryId: "cat-food",
      categoryName: "Food & Dining",
      paymentMethodId: "pm-upi",
      paymentMethodName: "UPI",
      accountId: "acct-bob",
      accountName: "Bank of Baroda Savings Account",
      type: "expense",
      date: "2026-03-13",
      tags: ["lunch", "pune"],
    });
  });

  it("parses the VC Cafe sample used in manual Telegram testing", () => {
    const result = parseTelegramMessage({
      text: "30 rs at VC Cafe for varan vati via BOB UPI category food",
      categories,
      paymentMethods,
      accounts,
      now: new Date("2026-03-14T00:00:00Z"),
    });

    expect(result).toMatchObject({
      amount: 30,
      merchant: "VC Cafe",
      notes: "varan vati",
      categoryId: "cat-food",
      paymentMethodId: "pm-upi",
      accountId: "acct-bob",
      date: "2026-03-14",
    });
  });

  it("uses leftover text as notes when the message has an at-merchant segment but no explicit for-notes segment", () => {
    const result = parseTelegramMessage({
      text: "Poli Bhaji at VC Cafe 60 via BOB UPI category Food",
      categories,
      paymentMethods,
      accounts,
      now: new Date("2026-03-13T00:00:00Z"),
    });

    expect(result.merchant).toBe("VC Cafe");
    expect(result.notes).toBe("Poli Bhaji");
    expect(result.accountId).toBe("acct-bob");
    expect(result.paymentMethodId).toBe("pm-upi");
  });

  it("matches card payments and account names from a single payment segment", () => {
    const result = parseTelegramMessage({
      text: "₹425 at Starbucks for coffee via ICICI credit card category food dining",
      categories,
      paymentMethods,
      accounts,
      now: new Date("2026-03-13T00:00:00Z"),
    });

    expect(result.amount).toBe(425);
    expect(result.merchant).toBe("Starbucks");
    expect(result.notes).toBe("coffee");
    expect(result.categoryId).toBe("cat-food");
    expect(result.paymentMethodId).toBe("pm-card");
    expect(result.accountId).toBe("acct-icici");
  });

  it("merges hashtag tags with explicit tags", () => {
    const result = parseTelegramMessage({
      text: "rs 60 at VC Cafe for Poli Bhaji via BOB UPI category Food tags lunch, dinner #pune #weekend",
      categories,
      paymentMethods,
      accounts,
      now: new Date("2026-03-13T00:00:00Z"),
    });

    expect(result.tags).toEqual(["pune", "weekend", "lunch", "dinner"]);
    expect(result.merchant).toBe("VC Cafe");
    expect(result.notes).toBe("Poli Bhaji");
  });

  it("parses strict key=value syntax and still resolves fuzzy entities", () => {
    const result = parseTelegramMessage({
      text: "amt=60; merchant=VC Cafe; notes=Poli Bhaji; account=BOB; payment=UPI; category=Food; tags=lunch,pune",
      categories,
      paymentMethods,
      accounts,
      now: new Date("2026-03-13T00:00:00Z"),
    });

    expect(result).toMatchObject({
      amount: 60,
      merchant: "VC Cafe",
      notes: "Poli Bhaji",
      categoryId: "cat-food",
      paymentMethodId: "pm-upi",
      accountId: "acct-bob",
      tags: ["lunch", "pune"],
    });
  });

  it("parses income messages with from/into phrasing and resolves income categories", () => {
    const result = parseTelegramMessage({
      text: "Received ₹50,000 from ACME Payroll into HDFC Salary Account via bank transfer category salary tags march,payroll",
      categories,
      paymentMethods,
      accounts,
      now: new Date("2026-03-13T00:00:00Z"),
    });

    expect(result).toMatchObject({
      amount: 50000,
      type: "income",
      merchant: "ACME Payroll",
      categoryId: "cat-salary",
      paymentMethodId: "pm-bank",
      accountId: "acct-hdfc",
      tags: ["march", "payroll"],
    });
  });

  it("prefers the leading income amount over account suffix digits", () => {
    const result = parseTelegramMessage({
      text: "received 1234 from Codex Payroll into BOB Savings 9965 category salary",
      categories,
      paymentMethods,
      accounts,
      now: new Date("2026-03-13T00:00:00Z"),
    });

    expect(result).toMatchObject({
      amount: 1234,
      type: "income",
      merchant: "Codex Payroll",
      accountId: "acct-bob",
      categoryId: "cat-salary",
    });
  });

  it("normalizes multi-line key-value Telegram messages", () => {
    const result = parseTelegramMessage({
      text: [
        "amt: 299",
        "merchant: Swiggy",
        "type: income",
        "account: ICICI",
        "payment: Credit Card",
        "category: Refund",
        "tags: refund, march",
      ].join("\n"),
      categories,
      paymentMethods,
      accounts,
      now: new Date("2026-03-13T00:00:00Z"),
    });

    expect(result).toMatchObject({
      amount: 299,
      type: "income",
      merchant: "Swiggy",
      categoryId: "cat-refund",
      paymentMethodId: "pm-card",
      accountId: "acct-icici",
      tags: ["refund", "march"],
    });
    expect(result.normalizedText).toContain("merchant: Swiggy");
  });
});
