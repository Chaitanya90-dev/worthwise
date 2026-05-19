import dayjs from "dayjs";
import type {
  Account,
  Category,
  PaymentMethod,
  TransactionRule,
} from "../types/finance";
import { applyRulesToTransaction } from "./rules";

export type BulkEntryRowDraft = {
  id: string;
  date: string;
  amount: string;
  merchant: string;
  notes: string;
  category_id: string;
  payment_method_id: string;
  account_id: string;
};

export type BulkEntryDefaults = {
  type: "expense" | "income";
  date: string;
  autoIncrementDate: boolean;
  category_id: string;
  payment_method_id: string;
  account_id: string;
};

export type BulkEntryResolvedRow = {
  id: string;
  date: string;
  amount: string;
  amountValue: number | null;
  merchant: string | null;
  notes: string | null;
  category_id: string | null;
  categoryLabel: string;
  payment_method_id: string | null;
  paymentLabel: string;
  account_id: string | null;
  accountLabel: string;
  tags: string[];
  errors: string[];
  isEmpty: boolean;
};

const isCardPaymentMethod = (method: PaymentMethod) => {
  const normalized = method.name.toLowerCase();
  return normalized.includes("card") || normalized.includes("pos");
};

const buildRowId = () =>
  typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `bulk-${Math.random().toString(36).slice(2, 10)}`;

export const createBulkEntryRow = (
  date: string,
  overrides: Partial<Omit<BulkEntryRowDraft, "id">> = {},
): BulkEntryRowDraft => ({
  id: buildRowId(),
  date,
  amount: "",
  merchant: "",
  notes: "",
  category_id: "",
  payment_method_id: "",
  account_id: "",
  ...overrides,
});

export const buildBulkEntryRows = (date: string, count = 5) =>
  Array.from({ length: count }, () => createBulkEntryRow(date));

export const getNextBulkEntryDate = ({
  baseDate,
  autoIncrementDate,
}: {
  baseDate: string;
  autoIncrementDate: boolean;
}) =>
  autoIncrementDate
    ? dayjs(baseDate).add(1, "day").format("YYYY-MM-DD")
    : baseDate;

export const resolveBulkEntryRow = ({
  row,
  defaults,
  categories,
  paymentMethods,
  accounts,
  rules,
}: {
  row: BulkEntryRowDraft;
  defaults: BulkEntryDefaults;
  categories: Category[];
  paymentMethods: PaymentMethod[];
  accounts: Account[];
  rules: TransactionRule[];
}): BulkEntryResolvedRow => {
  const merchant = row.merchant.trim() || null;
  const notes = row.notes.trim() || null;
  const isEmpty =
    !row.amount.trim() && !row.merchant.trim() && !row.notes.trim();
  const parsedAmount = row.amount.trim() ? Number(row.amount) : null;
  const amountValue =
    parsedAmount !== null &&
    Number.isFinite(parsedAmount) &&
    parsedAmount > 0
      ? parsedAmount
      : null;

  const ruled = applyRulesToTransaction(
    {
      merchant,
      notes,
      type: defaults.type,
      category_id: row.category_id || null,
      account_id: row.account_id || null,
      payment_method_id: row.payment_method_id || null,
      tags: [],
    },
    rules,
  );

  const effectiveAccountId =
    row.account_id || ruled.account_id || defaults.account_id || "";
  const account = accounts.find((item) => item.id === effectiveAccountId) ?? null;
  const defaultCardPayment =
    paymentMethods.find((item) => isCardPaymentMethod(item)) ?? null;
  const explicitPaymentMethodId = row.payment_method_id || "";
  const ruledPaymentMethodId = ruled.payment_method_id || "";
  const defaultPaymentMethodId = defaults.payment_method_id || "";
  const explicitPayment =
    paymentMethods.find((item) => item.id === explicitPaymentMethodId) ?? null;
  const ruledPayment =
    paymentMethods.find((item) => item.id === ruledPaymentMethodId) ?? null;
  const defaultPayment =
    paymentMethods.find((item) => item.id === defaultPaymentMethodId) ?? null;
  const selectedPayment = explicitPayment
    ? explicitPayment
    : ruledPayment
      ? ruledPayment
      : account?.type === "card"
        ? defaultPayment && isCardPaymentMethod(defaultPayment)
          ? defaultPayment
          : defaultCardPayment
        : defaultPayment;

  const categoryId =
    row.category_id || ruled.category_id || defaults.category_id || null;
  const category = categories.find((item) => item.id === categoryId) ?? null;

  const errors: string[] = [];
  if (!isEmpty) {
    if (
      !row.date ||
      !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
      !dayjs(row.date).isValid()
    ) {
      errors.push("Enter a valid date.");
    }
    if (amountValue === null) {
      errors.push("Enter an amount greater than 0.");
    }
    if (!merchant && !notes) {
      errors.push("Add a merchant or notes.");
    }
    if (!effectiveAccountId) {
      errors.push("Choose an account.");
    }
    if (
      account?.type === "card" &&
      selectedPayment &&
      !isCardPaymentMethod(selectedPayment)
    ) {
      errors.push("Card accounts need a card payment method.");
    }
  }

  return {
    id: row.id,
    date: row.date,
    amount: row.amount,
    amountValue,
    merchant,
    notes,
    category_id: categoryId,
    categoryLabel: category?.name ?? "Uncategorized",
    payment_method_id: selectedPayment?.id ?? null,
    paymentLabel: selectedPayment?.name ?? "Unspecified",
    account_id: effectiveAccountId || null,
    accountLabel: account?.name ?? "Unspecified",
    tags: ruled.tags,
    errors,
    isEmpty,
  };
};
