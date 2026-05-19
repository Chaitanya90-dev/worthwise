import type { Transaction } from "../types/finance";
export {
  getTransactionCounterpartyKind,
  getTransactionCounterpartyName,
} from "./counterparty";

export const isReimbursement = (tx: Transaction) =>
  tx.type === "income" && Boolean(tx.is_reimbursement);

export const getReimbursementCategoryId = (tx: Transaction) =>
  tx.reimbursement_category_id ?? tx.category_id ?? null;

export const getDisplayCategoryId = (tx: Transaction) =>
  isReimbursement(tx) ? getReimbursementCategoryId(tx) : tx.category_id ?? null;

export const getNetExpenseCategoryKey = (tx: Transaction) => {
  if (tx.is_transfer) {
    return null;
  }
  if (tx.type === "expense") {
    return tx.category_id ?? "uncategorized";
  }
  if (isReimbursement(tx)) {
    return getReimbursementCategoryId(tx) ?? "uncategorized";
  }
  return null;
};

export const getNetExpenseDelta = (tx: Transaction) => {
  if (tx.is_transfer) {
    return 0;
  }
  if (tx.type === "expense") {
    return tx.amount;
  }
  if (isReimbursement(tx)) {
    return -tx.amount;
  }
  return 0;
};

export const getIncomeDelta = (tx: Transaction) => {
  if (tx.is_transfer || tx.type !== "income" || isReimbursement(tx)) {
    return 0;
  }
  return tx.amount;
};
