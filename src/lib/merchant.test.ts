import { describe, expect, it } from "vitest";
import { buildFrequentMerchantOptions } from "./merchant";
import type { Transaction } from "../types/finance";

const tx = (
  id: string,
  merchant: string | null,
  date: string
): Transaction => ({
  id,
  type: "expense",
  date,
  amount: 100,
  category_id: null,
  payment_method_id: null,
  account_id: null,
  merchant,
  notes: null,
  is_recurring: false,
  tags: [],
});

describe("buildFrequentMerchantOptions", () => {
  it("orders merchants by frequency then recency", () => {
    const options = buildFrequentMerchantOptions([
      tx("1", "Swiggy", "2026-01-01"),
      tx("2", "swiggy", "2026-01-10"),
      tx("3", "SWIGGY", "2026-01-15"),
      tx("4", "Amazon", "2026-01-12"),
      tx("5", "BigBasket", "2026-01-11"),
      tx("6", "amazon", "2026-01-13"),
      tx("7", "BigBasket", "2026-01-05"),
    ]);

    expect(options).toEqual(["SWIGGY", "amazon", "BigBasket"]);
  });

  it("ignores empty merchant values", () => {
    const options = buildFrequentMerchantOptions([
      tx("1", null, "2026-01-01"),
      tx("2", "", "2026-01-02"),
      tx("3", "  ", "2026-01-03"),
      tx("4", "Rent", "2026-01-04"),
    ]);

    expect(options).toEqual(["Rent"]);
  });
});
