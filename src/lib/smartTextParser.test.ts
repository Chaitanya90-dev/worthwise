import { describe, it, expect } from "vitest";
import {
  parseSmartText,
  parseFreeFormLine,
  SMS_TEMPLATES,
} from "./smartTextParser";

/* ─── Helpers ────────────────────────────────────────── */

const emptyLookups = {
  categoryByName: new Map<string, string>(),
  categoryById: new Map<string, string>(),
  paymentByName: new Map<string, string>(),
  paymentById: new Map<string, string>(),
  accountByName: new Map<string, string>(),
  accountById: new Map<string, string>(),
};

const emptyDefaults = {
  defaultType: "expense" as const,
  defaultCategoryId: "",
  defaultPaymentId: "",
  defaultAccountId: "",
  recurring: false,
};

const parse = (text: string) =>
  parseSmartText({ text, defaults: emptyDefaults, lookups: emptyLookups });

/* ─── Template matching (regex sanity) ───────────────── */

describe("SMS_TEMPLATES", () => {
  it("should have unique template IDs", () => {
    const ids = SMS_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

/* ─── ICICI Credit Card ──────────────────────────────── */

describe("ICICI CC template", () => {
  it("parses standard ICICI CC SMS", () => {
    const sms =
      "Your ICICI Bank Credit Card XX1004 has been used for a transaction of INR 369.00 on Jan 27, 2025 at link. Info: Raz*TATA PLAY LIMITED. The Available Credit Limit is INR 59,023.92";
    const result = parse(sms);
    expect(
      result.summary.parsed + result.summary.partial,
    ).toBeGreaterThanOrEqual(1);
    const row = result.validRows[0];
    expect(row).toBeDefined();
    expect(row.data.amount).toBe(369);
    expect(row.data.type).toBe("expense");
    expect(row.data.date).toBe("2025-01-27");
    expect(row.data.merchant).toContain("TATA PLAY");
  });
});

/* ─── Bank of Baroda ─────────────────────────────────── */

describe("BOB debit template", () => {
  it("parses BOB debit SMS with UPI details", () => {
    const sms =
      "A/c XX1234 debited INR 250.00 on 05-Mar-26 UPI/Google Pay/CoffeeDay. Avl Bal INR 12,450.00";
    const result = parse(sms);
    expect(
      result.summary.parsed + result.summary.partial,
    ).toBeGreaterThanOrEqual(1);
    const row = result.validRows[0];
    expect(row).toBeDefined();
    expect(row.data.amount).toBe(250);
    expect(row.data.date).toBe("2026-03-05");
    expect(row.data.type).toBe("expense");
  });

  it("parses BOB debit alt SMS (Dr/Cr format)", () => {
    const sms =
      "Rs.60.00 Dr. from A/C XXXXXX9965 and Cr. to 9823742883@okbizaxis. Ref:119741822769. AvlBal:Rs42541.14(2026:03:09 01:05:42). Not you? Call 18005700/5000-BOB";
    const result = parse(sms);
    expect(
      result.summary.parsed + result.summary.partial,
    ).toBeGreaterThanOrEqual(1);
    const row = result.validRows[0];
    expect(row).toBeDefined();
    expect(row.data.amount).toBe(60);
    expect(row.data.date).toBe("2026-03-09");
    expect(row.data.type).toBe("expense");
    expect(row.data.merchant).toBe("9823742883@okbizaxis");
  });
});

/* ─── Generic UPI ────────────────────────────────────── */

describe("UPI templates", () => {
  it("parses UPI paid SMS", () => {
    const sms =
      "Rs 425 paid to Zomato via PhonePe UPI on 07/03/2026. UPI Ref 412345678901";
    const result = parse(sms);
    expect(
      result.summary.parsed + result.summary.partial,
    ).toBeGreaterThanOrEqual(1);
    const row = result.validRows[0];
    expect(row).toBeDefined();
    expect(row.data.amount).toBe(425);
    expect(row.data.merchant).toBe("Zomato");
    expect(row.data.type).toBe("expense");
  });

  it("parses UPI app history style", () => {
    const line = "Paid to Uber ₹180 7 Mar 2026";
    const result = parse(line);
    expect(
      result.summary.parsed + result.summary.partial,
    ).toBeGreaterThanOrEqual(1);
    const row = result.validRows[0];
    expect(row).toBeDefined();
    expect(row.data.amount).toBe(180);
    expect(row.data.merchant).toBe("Uber");
    expect(row.data.date).toBe("2026-03-07");
  });

  it("parses UPI received", () => {
    const line = "Received from Rahul ₹500 6 Mar 2026";
    const result = parse(line);
    expect(result.validRows.length).toBeGreaterThanOrEqual(1);
    const row = result.validRows[0];
    expect(row.data.type).toBe("income");
    expect(row.data.amount).toBe(500);
  });
});

/* ─── Free-form lines ────────────────────────────────── */

describe("parseFreeFormLine", () => {
  it("should parse date, amount, and text", () => {
    const result = parseFreeFormLine("Mar 5 lunch 250");
    expect(result).toMatchObject({
      amount: 250,
      merchant: "lunch",
      notes: "",
      paymentHint: "",
    });
    expect(result?.date).toMatch(/^\d{4}-03-05$/); // Year depends on when test is run
  });

  it("should extract notes and merchant cleanly using 'at' delimiter", () => {
    const result = parseFreeFormLine("Virtus Petrol at Indian Oil 2000 rs");
    expect(result).toMatchObject({
      amount: 2000,
      merchant: "Indian Oil",
      notes: "Virtus Petrol",
      paymentHint: "",
    });
  });

  it("should extract notes and merchant when amount is in the middle", () => {
    const result = parseFreeFormLine("2 night stay Vagator at AirBnB 5836 rs");
    expect(result).toMatchObject({
      amount: 5836,
      merchant: "AirBnB",
      notes: "2 night stay Vagator",
      paymentHint: "",
    });
  });

  it("should parse full date with payment hint", () => {
    const result = parseFreeFormLine("2026-03-05 uber 480");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(480);
    expect(result!.date).toBe("2026-03-05");
    expect(result!.merchant).toContain("uber");
  });

  it("parses 'dinner ₹350 cash' without date", () => {
    const result = parseFreeFormLine("dinner ₹350 cash");
    expect(result).not.toBeNull();
    expect(result!.amount).toBe(350);
    expect(result!.paymentHint).toBe("cash");
    expect(result!.source).toBe("free-form-no-date");
  });

  it("parses telegram-style line with at/for/via segments", () => {
    const result = parseFreeFormLine(
      "30 rs at VC Cafe for varan vati via BOB UPI category food",
    );
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      amount: 30,
      merchant: "VC Cafe",
      notes: "varan vati",
      paymentHint: "BOB UPI",
      accountHint: "BOB",
      source: "free-form-no-date",
    });
  });

  it("parses strict key=value syntax in Smart Paste free-form", () => {
    const result = parseFreeFormLine(
      "amt=60; merchant=VC Cafe; notes=Poli Bhaji; account=BOB; payment=UPI; category=Food; tags=lunch,pune",
    );
    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      amount: 60,
      merchant: "VC Cafe",
      notes: "Poli Bhaji",
      categoryHint: "Food",
      paymentHint: "UPI",
      accountHint: "BOB",
      tags: ["lunch", "pune"],
      source: "free-form-no-date",
    });
  });

  it("returns null for empty/garbage input", () => {
    expect(parseFreeFormLine("")).toBeNull();
    expect(parseFreeFormLine("..")).toBeNull();
    expect(parseFreeFormLine("hello")).toBeNull();
  });
});

/* ─── Multi-line mixed input ─────────────────────────── */

describe("parseSmartText (multi-line)", () => {
  it("handles mixed SMS + free-form input", () => {
    const text = `
Rs 425 paid to Zomato via PhonePe UPI on 07/03/2026. UPI Ref 412345678901
Mar 5 lunch 250
this line has no data
Mar 6 hotel 3500
    `;
    const result = parse(text);
    // Due to stitchLines, "this line has no data" gets appended to "Mar 5 lunch 250"
    expect(result.summary.total).toBe(3);
    expect(
      result.summary.parsed + result.summary.partial,
    ).toBeGreaterThanOrEqual(3);
    expect(result.summary.failed).toBe(0);
    expect(result.validRows.length).toBeGreaterThanOrEqual(3);
  });

  it("returns empty result for empty input", () => {
    const result = parse("");
    expect(result.summary.total).toBe(0);
    expect(result.validRows.length).toBe(0);
  });
});

/* ─── Rules integration ──────────────────────────────── */

describe("rules integration", () => {
  it("applies category from rules when merchant matches", () => {
    const catId = "cat-food-id";
    const lookups = {
      ...emptyLookups,
      categoryById: new Map([["cat-food-id", "Food & Dining"]]),
    };
    const rules = [
      {
        id: "r1",
        name: "Zomato → Food",
        match_text: "zomato",
        match_type: "contains" as const,
        transaction_type: "any" as const,
        category_id: catId,
        tag_names: [],
        is_active: true,
        priority: 100,
      },
    ];
    const result = parseSmartText({
      text: "Paid to Zomato ₹425 7 Mar 2026",
      defaults: emptyDefaults,
      lookups,
      rules,
    });
    expect(result.validRows[0]?.data.category_id).toBe(catId);
    expect(result.validRows[0]?.preview.category).toBe("Food & Dining");
  });
});

/* ─── Account mapping ────────────────────────────────── */

describe("account mapping", () => {
  it("maps extracted accountHint to saved account name", () => {
    const acctId = "acct-bob-id";
    const lookups = {
      ...emptyLookups,
      accountByName: new Map([["BOB Savings 9965", acctId]]),
      accountById: new Map([[acctId, "BOB Savings 9965"]]),
    };

    // Test with Bank of Baroda debit template which extracts 9965
    const result = parseSmartText({
      text: "A/c XX9965 debited INR 250.00 on 05-Mar-26 UPI/Google Pay/CoffeeDay. Avl Bal INR 12,450.00",
      defaults: emptyDefaults,
      lookups,
    });

    expect(result.validRows[0]?.data.account_id).toBe(acctId);
    expect(result.validRows[0]?.preview.account).toBe("BOB Savings 9965");
  });
});
