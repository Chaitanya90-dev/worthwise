import { describe, expect, it } from "vitest";
import {
  buildDefaultMapping,
  buildParsedCsv,
  isMappingReady,
  parseImportRows,
  type CsvMapping,
} from "./transactionImport";

describe("transaction import utilities", () => {
  it("auto-maps common headers including dr/cr fields", () => {
    const headers = [
      "date",
      "place",
      "amount_inr",
      "expense",
      "income",
      "category",
      "tags",
      "dr_cr",
    ];
    const mapping = buildDefaultMapping(headers);

    expect(mapping.date).toBe("0");
    expect(mapping.amount).toBe("2");
    expect(mapping.debit).toBe("3");
    expect(mapping.credit).toBe("4");
    expect(mapping.type).toBe("7");
    expect(mapping.category).toBe("5");
    expect(mapping.merchant).toBe("1");
    expect(mapping.tags).toBe("6");
  });

  it("parses rows with amount or debit/credit and assigns categories, payments, tags", () => {
    const parsedCsv = {
      headers: [],
      rows: [
        [
          "2024-08-01",
          "Lunch",
          "-120",
          "",
          "",
          "Food",
          "UPI",
          "food, lunch",
          "dr",
        ],
        [
          "2024-08-02",
          "Salary",
          "",
          "",
          "50000",
          "Income",
          "Bank",
          "",
          "cr",
        ],
        ["not-a-date", "Bad", "", "0", "0", "", "", "", ""],
      ],
      delimiter: ",",
    } as ReturnType<typeof buildParsedCsv>;

    const mapping: CsvMapping = {
      date: "0",
      amount: "2",
      debit: "3",
      credit: "4",
      type: "8",
      category: "5",
      payment: "6",
      account: "",
      merchant: "1",
      notes: "1",
      tags: "7",
    };

    expect(isMappingReady(mapping)).toBe(true);

    const defaults = {
      defaultType: "expense" as const,
      defaultCategoryId: "",
      defaultPaymentId: "",
      defaultAccountId: "",
      recurring: false,
    };

    const lookups = {
      categoryByName: new Map([
        ["food", "c1"],
        ["income", "c2"],
      ]),
      categoryById: new Map([
        ["c1", "Food"],
        ["c2", "Income"],
      ]),
      paymentByName: new Map([
        ["upi", "p1"],
        ["bank", "p2"],
      ]),
      paymentById: new Map([
        ["p1", "UPI"],
        ["p2", "Bank"],
      ]),
      accountByName: new Map(),
      accountById: new Map(),
    };

    const result = parseImportRows({
      parsedCsv,
      mapping,
      hasHeader: false,
      defaults,
      lookups,
    });

    expect(result.validRows).toHaveLength(2);
    expect(result.invalidRows).toHaveLength(1);

    const [row1, row2] = result.validRows;

    expect(row1.data).toMatchObject({
      type: "expense",
      amount: 120,
      category_id: "c1",
      payment_method_id: "p1",
      merchant: "Lunch",
      tags: ["food", "lunch"],
      notes: "Lunch",
    });

    expect(row2.data).toMatchObject({
      type: "income",
      amount: 50000,
      category_id: "c2",
      payment_method_id: "p2",
      tags: [],
    });

    expect(result.invalidRows[0].errors).toContain("Invalid date");
  });
});
