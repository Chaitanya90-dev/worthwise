import dayjs from "dayjs";
import type { Transaction } from "../types/finance";
import { formatINR } from "./format";
import { scoreSearchMatch } from "./globalSearch";
import { getDisplayAmount } from "./moneyConfig";

export type TransactionFilterState = {
  search: string;
  accountId: string;
  categoryId: string;
  paymentId: string;
  tags: string[];
  type: "" | "expense" | "income" | "transfer";
  flags: string[];
  dateFrom: string;
  dateTo: string;
  minAmount: string;
  maxAmount: string;
};

export type FilterableTransaction = Pick<
  Transaction,
  | "amount"
  | "currency"
  | "category_id"
  | "date"
  | "is_recurring"
  | "is_reimbursement"
  | "is_shared"
  | "payment_method_id"
  | "tags"
  | "type"
> & {
  displayAccount: string;
  displayAccountIds: string[];
  displayCategory: string;
  displayMerchant: string;
  displayNotes: string;
  displayPayment: string;
  displayTags: string;
  isGroupedTransfer: boolean;
};

type TransactionFilterInput = Partial<Omit<TransactionFilterState, "type">> & {
  tag?: string;
  tags?: string[];
  type?: string;
};

const uniqueValues = (values: string[]) =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).sort();

const normalizeAmount = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDate = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed : "";
};

const matchFlag = (transaction: FilterableTransaction, flag: string) => {
  switch (flag) {
    case "recurring":
      return transaction.is_recurring;
    case "shared":
      return Boolean(transaction.is_shared);
    case "reimbursement":
      return Boolean(transaction.is_reimbursement);
    case "uncategorized":
      return !transaction.category_id;
    case "untagged":
      return !transaction.tags?.length;
    case "has-notes":
      return Boolean(transaction.displayNotes && transaction.displayNotes !== "-");
    default:
      return true;
  }
};

export const createEmptyTransactionFilters = (): TransactionFilterState => ({
  search: "",
  accountId: "",
  categoryId: "",
  paymentId: "",
  tags: [],
  type: "",
  flags: [],
  dateFrom: "",
  dateTo: "",
  minAmount: "",
  maxAmount: "",
});

export const normalizeTransactionFilters = (
  value: TransactionFilterInput = {}
): TransactionFilterState => ({
  search: value.search?.trim() ?? "",
  accountId: value.accountId?.trim() ?? "",
  categoryId: value.categoryId?.trim() ?? "",
  paymentId: value.paymentId?.trim() ?? "",
  tags: uniqueValues(
    Array.isArray(value.tags) && value.tags.length > 0
      ? value.tags
      : value.tag
      ? [value.tag]
      : []
  ),
  type:
    value.type === "expense" ||
    value.type === "income" ||
    value.type === "transfer"
      ? value.type
      : "",
  flags: uniqueValues(Array.isArray(value.flags) ? value.flags : []),
  dateFrom: normalizeDate(value.dateFrom ?? ""),
  dateTo: normalizeDate(value.dateTo ?? ""),
  minAmount: value.minAmount?.trim() ?? "",
  maxAmount: value.maxAmount?.trim() ?? "",
});

export const areTransactionFiltersEqual = (
  left: TransactionFilterInput,
  right: TransactionFilterInput
) => {
  const normalizedLeft = normalizeTransactionFilters(left);
  const normalizedRight = normalizeTransactionFilters(right);
  return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight);
};

export const filterTransactions = <T extends FilterableTransaction>(
  transactions: T[],
  value: TransactionFilterInput
) => {
  const filters = normalizeTransactionFilters(value);
  const minAmount = normalizeAmount(filters.minAmount);
  const maxAmount = normalizeAmount(filters.maxAmount);
  const minDate =
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
      ? filters.dateTo
      : filters.dateFrom;
  const maxDate =
    filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo
      ? filters.dateFrom
      : filters.dateTo;
  const lowerAmount =
    minAmount !== null && maxAmount !== null && minAmount > maxAmount
      ? maxAmount
      : minAmount;
  const upperAmount =
    minAmount !== null && maxAmount !== null && minAmount > maxAmount
      ? minAmount
      : maxAmount;

  return transactions.filter((transaction) => {
    const isTransfer = transaction.isGroupedTransfer;
    const comparableAmount =
      getDisplayAmount(transaction.amount, transaction.currency) ?? transaction.amount;

    if (filters.accountId === "none" && transaction.displayAccountIds.length > 0) {
      return false;
    }
    if (
      filters.accountId &&
      filters.accountId !== "none" &&
      !transaction.displayAccountIds.includes(filters.accountId)
    ) {
      return false;
    }

    if (filters.categoryId === "uncategorized" && transaction.category_id) {
      return false;
    }
    if (
      filters.categoryId &&
      filters.categoryId !== "uncategorized" &&
      transaction.category_id !== filters.categoryId
    ) {
      return false;
    }

    if (filters.paymentId === "none" && transaction.payment_method_id) {
      return false;
    }
    if (
      filters.paymentId &&
      filters.paymentId !== "none" &&
      transaction.payment_method_id !== filters.paymentId
    ) {
      return false;
    }

    if (filters.type === "transfer" && !isTransfer) {
      return false;
    }
    if (filters.type && filters.type !== "transfer") {
      if (isTransfer || transaction.type !== filters.type) {
        return false;
      }
    }

    if (
      filters.tags.length > 0 &&
      !filters.tags.every((tag) =>
        transaction.tags?.some((existingTag) => existingTag.name === tag)
      )
    ) {
      return false;
    }

    if (filters.flags.some((flag) => !matchFlag(transaction, flag))) {
      return false;
    }

    if (minDate && transaction.date < minDate) {
      return false;
    }
    if (maxDate && transaction.date > maxDate) {
      return false;
    }

    if (lowerAmount !== null && comparableAmount < lowerAmount) {
      return false;
    }
    if (upperAmount !== null && comparableAmount > upperAmount) {
      return false;
    }

    if (!filters.search) {
      return true;
    }

    const flagLabels = [
      isTransfer ? "transfer" : "",
      transaction.type,
      transaction.is_recurring ? "recurring" : "",
      transaction.is_shared ? "shared" : "",
      transaction.is_reimbursement ? "reimbursement" : "",
      transaction.category_id ? "" : "uncategorized",
      transaction.tags?.length ? "" : "untagged",
    ].filter(Boolean);
    const formattedAmount = formatINR(transaction.amount, transaction.currency);
    const searchScore = scoreSearchMatch({
      query: filters.search,
      primaryText:
        transaction.displayMerchant ||
        transaction.displayCategory ||
        transaction.displayAccount,
      aliasTexts: [
        transaction.displayCategory,
        transaction.displayMerchant,
        transaction.displayAccount,
        transaction.displayPayment,
        transaction.displayNotes,
        transaction.displayTags,
        dayjs(transaction.date).format("DD MMM YYYY"),
        ...flagLabels,
      ],
      valueTexts: [
        String(transaction.amount),
        String(comparableAmount),
        formattedAmount,
        formattedAmount.replace(/[^\d.]/g, ""),
      ],
    });

    return searchScore !== null;
  });
};
