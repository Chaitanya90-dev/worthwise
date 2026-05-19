import type { Transaction } from "../types/finance";
import { getTransactionCounterpartyName } from "./transactions";

type MerchantStats = {
  name: string;
  count: number;
  latestDate: string;
};

export const buildFrequentMerchantOptions = (
  transactions: Transaction[],
  limit = 30
) => {
  const stats = new Map<string, MerchantStats>();

  transactions.forEach((tx) => {
    const rawMerchant = getTransactionCounterpartyName(tx);
    if (!rawMerchant) {
      return;
    }
    const key = rawMerchant.toLowerCase();
    const existing = stats.get(key);
    if (existing) {
      existing.count += 1;
      if (tx.date > existing.latestDate) {
        existing.latestDate = tx.date;
        existing.name = rawMerchant;
      }
      return;
    }
    stats.set(key, {
      name: rawMerchant,
      count: 1,
      latestDate: tx.date,
    });
  });

  return Array.from(stats.values())
    .sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }
      if (a.latestDate !== b.latestDate) {
        return b.latestDate.localeCompare(a.latestDate);
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, limit)
    .map((item) => item.name);
};
