import { describe, expect, it } from "vitest";
import {
  getTransactionCounterpartyName,
  inferCounterpartyKind,
  resolveCounterpartyFields,
} from "./counterparty";

describe("counterparty helpers", () => {
  it("keeps merchant and counterparty_name in sync", () => {
    expect(
      resolveCounterpartyFields({
        merchant: "  VC Cafe  ",
      }),
    ).toEqual({
      merchant: "VC Cafe",
      counterparty_name: "VC Cafe",
      counterparty_kind: "merchant",
    });
  });

  it("infers bank, biller, and platform kinds from names", () => {
    expect(inferCounterpartyKind({ name: "NEFT HDFC Bank Transfer" })).toBe(
      "bank",
    );
    expect(inferCounterpartyKind({ name: "Axis MaxLife term insurance" })).toBe(
      "biller",
    );
    expect(inferCounterpartyKind({ name: "Amazon Pay India" })).toBe(
      "platform",
    );
  });

  it("prefers explicit counterparty name over merchant and notes", () => {
    expect(
      getTransactionCounterpartyName({
        counterparty_name: "Blue Tokai",
        merchant: "Legacy merchant",
        notes: "Coffee",
      }),
    ).toBe("Blue Tokai");
  });
});
