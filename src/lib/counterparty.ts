import type { CounterpartyKind, Transaction } from "../types/finance";

const PLATFORM_KEYWORDS =
  /\b(amazon|flipkart|swiggy|zomato|uber|ola|netflix|spotify|youtube|google|apple|phonepe|gpay|google pay|paytm|razorpay|airbnb)\b/i;
const BANK_KEYWORDS =
  /\b(bank|neft|imps|rtgs|acct|account|a\/c|ifsc|upi from|upi to|transfer)\b/i;
const BILLER_KEYWORDS =
  /\b(rent|insurance|premium|loan|emi|subscription|recharge|electricity|water|gas|broadband|internet|bill|tax|term plan)\b/i;

export const normalizeCounterpartyName = (
  value: string | null | undefined,
) => {
  const normalized = (value ?? "").trim().replace(/\s+/g, " ");
  return normalized || null;
};

export const inferCounterpartyKind = ({
  name,
  kind,
}: {
  name?: string | null;
  kind?: CounterpartyKind | null;
}): CounterpartyKind | null => {
  if (kind) {
    return kind;
  }

  const normalizedName = normalizeCounterpartyName(name);
  if (!normalizedName) {
    return null;
  }

  if (PLATFORM_KEYWORDS.test(normalizedName)) {
    return "platform";
  }
  if (BANK_KEYWORDS.test(normalizedName)) {
    return "bank";
  }
  if (BILLER_KEYWORDS.test(normalizedName)) {
    return "biller";
  }

  return "merchant";
};

export const resolveCounterpartyFields = ({
  counterpartyName,
  counterpartyKind,
  merchant,
}: {
  counterpartyName?: string | null;
  counterpartyKind?: CounterpartyKind | null;
  merchant?: string | null;
}) => {
  const normalizedName = normalizeCounterpartyName(counterpartyName ?? merchant);
  return {
    merchant: normalizedName,
    counterparty_name: normalizedName,
    counterparty_kind: inferCounterpartyKind({
      name: normalizedName,
      kind: counterpartyKind,
    }),
  };
};

export const getTransactionCounterpartyName = (
  transaction: Pick<Transaction, "counterparty_name" | "merchant" | "notes">,
) =>
  normalizeCounterpartyName(transaction.counterparty_name) ??
  normalizeCounterpartyName(transaction.merchant) ??
  normalizeCounterpartyName(transaction.notes) ??
  "";

export const getTransactionCounterpartyKind = (
  transaction: Pick<Transaction, "counterparty_name" | "counterparty_kind" | "merchant">,
) =>
  transaction.counterparty_kind ??
  inferCounterpartyKind({
    name: transaction.counterparty_name ?? transaction.merchant ?? null,
  });
