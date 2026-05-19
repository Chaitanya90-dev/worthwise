import type { Transaction } from "../types/finance";
import type { FilterableTransaction } from "./transactionFilters";
import {
  getDisplayCategoryId,
  getTransactionCounterpartyName,
} from "./transactions";

export type DisplayTransaction = Transaction &
  FilterableTransaction & {
    rowId: string;
  };

export const buildDisplayTransactions = ({
  transactions,
  categoryMap,
  accountMap,
  accountCurrencyMap,
  paymentMap,
}: {
  transactions: Transaction[];
  categoryMap: Map<string, string>;
  accountMap: Map<string, string>;
  accountCurrencyMap: Map<string, string>;
  paymentMap: Map<string, string>;
}) => {
  const result: DisplayTransaction[] = [];
  const seenGroups = new Set<string>();
  const transferGroups = new Map<string, Transaction[]>();

  transactions.forEach((transaction) => {
    if (transaction.is_transfer && transaction.transfer_group_id) {
      const items = transferGroups.get(transaction.transfer_group_id) ?? [];
      items.push(transaction);
      transferGroups.set(transaction.transfer_group_id, items);
    }
  });

  const buildSingle = (transaction: Transaction): DisplayTransaction => {
    const displayCategoryId = getDisplayCategoryId(transaction);
    const categoryLabel = displayCategoryId
      ? categoryMap.get(displayCategoryId) ?? "Uncategorized"
      : "Uncategorized";
    const accountLabel = transaction.account_id
      ? accountMap.get(transaction.account_id) ?? "-"
      : "-";
    const paymentLabel = transaction.payment_method_id
      ? paymentMap.get(transaction.payment_method_id) ?? "-"
      : "-";
    return {
      ...transaction,
      rowId: transaction.id,
      displayCategory: categoryLabel,
      displayMerchant: getTransactionCounterpartyName(transaction),
      displayAccount: accountLabel,
      displayAccountIds: transaction.account_id ? [transaction.account_id] : [],
      currency:
        transaction.currency ??
        (transaction.account_id
          ? accountCurrencyMap.get(transaction.account_id) ?? null
          : null),
      displayPayment: paymentLabel,
      displayNotes: transaction.notes?.trim() ?? "",
      displayTags: transaction.tags?.length
        ? transaction.tags.map((tag) => tag.name).join(", ")
        : "-",
      isGroupedTransfer: false,
    };
  };

  transactions.forEach((transaction) => {
    const groupId = transaction.transfer_group_id;
    if (transaction.is_transfer && groupId) {
      const group = transferGroups.get(groupId) ?? [];
      const expense = group.find((item) => item.type === "expense");
      const income = group.find((item) => item.type === "income");
      if (expense && income) {
        if (seenGroups.has(groupId)) {
          return;
        }
        seenGroups.add(groupId);
        const fromId = expense.account_id ?? "";
        const toId = income.account_id ?? "";
        const fromLabel = fromId ? accountMap.get(fromId) ?? "Unknown" : "Unknown";
        const toLabel = toId ? accountMap.get(toId) ?? "Unknown" : "";
        const accountLabel = toLabel ? `${fromLabel} → ${toLabel}` : fromLabel;
        result.push({
          ...expense,
          rowId: `transfer-${groupId}`,
          displayCategory: "Transfer",
          displayMerchant: getTransactionCounterpartyName(expense),
          displayAccount: accountLabel,
          displayAccountIds: [fromId, toId].filter(Boolean),
          currency:
            expense.currency ??
            (fromId ? accountCurrencyMap.get(fromId) ?? null : null),
          displayPayment: "-",
          displayNotes: expense.notes?.trim() ?? "",
          displayTags: expense.tags?.length
            ? expense.tags.map((tag) => tag.name).join(", ")
            : "-",
          isGroupedTransfer: true,
        });
        return;
      }
    }
    result.push(buildSingle(transaction));
  });

  return result;
};
