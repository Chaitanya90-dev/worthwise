import type { Transaction } from "../types/finance";
import { getTransactionCounterpartyName } from "./transactions";

export type CounterpartyInsight = {
  name: string;
  count: number;
};

export type WhatChangedInsights = {
  newCounterparties: CounterpartyInsight[];
  totalNewCounterparties: number;
};

const normalizeCounterparty = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, " ");

const formatCounterparty = (value: string) => {
  const cleaned = value.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 48) {
    return cleaned;
  }
  return `${cleaned.slice(0, 45)}...`;
};

const resolveCounterpartyText = (tx: Transaction) =>
  getTransactionCounterpartyName(tx) || tx.notes?.trim() || "";

const isEligibleTransaction = (tx: Transaction) =>
  !tx.is_transfer && !tx.is_reimbursement && Boolean(resolveCounterpartyText(tx));

export const buildWhatChangedInsights = ({
  current,
  previous,
  maxMerchants = 3,
}: {
  current: Transaction[];
  previous: Transaction[];
  maxMerchants?: number;
}): WhatChangedInsights => {
  const prevSet = new Set(
    previous
      .filter(isEligibleTransaction)
      .map((tx) => normalizeCounterparty(resolveCounterpartyText(tx)))
      .filter(Boolean)
  );

  const currentCounts = new Map<string, { name: string; count: number }>();
  current
    .filter(isEligibleTransaction)
    .forEach((tx) => {
      const counterparty = resolveCounterpartyText(tx);
      const normalized = normalizeCounterparty(counterparty);
      if (!normalized || prevSet.has(normalized)) {
        return;
      }
      const existing = currentCounts.get(normalized);
      if (existing) {
        existing.count += 1;
        return;
      }
      currentCounts.set(normalized, {
        name: formatCounterparty(counterparty),
        count: 1,
      });
    });

  const newCounterparties = Array.from(currentCounts.values()).sort(
    (a, b) => b.count - a.count
  );

  return {
    newCounterparties: newCounterparties.slice(0, maxMerchants),
    totalNewCounterparties: newCounterparties.length,
  };
};
