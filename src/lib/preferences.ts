export type TransactionDefaults = {
  account_id: string;
  payment_method_id: string;
  category_id: string;
};

const buildDefaultsKey = (userId?: string | null) =>
  `cashcove:defaults:${userId ?? "anon"}`;

export const loadTransactionDefaults = (
  userId?: string | null
): TransactionDefaults | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(buildDefaultsKey(userId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<TransactionDefaults>;
    return {
      account_id: parsed.account_id ?? "",
      payment_method_id: parsed.payment_method_id ?? "",
      category_id: parsed.category_id ?? "",
    };
  } catch {
    return null;
  }
};

export const saveTransactionDefaults = (
  userId: string | null | undefined,
  next: Partial<TransactionDefaults>
) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const current = loadTransactionDefaults(userId) ?? {
      account_id: "",
      payment_method_id: "",
      category_id: "",
    };
    const payload = {
      ...current,
      ...next,
    };
    window.localStorage.setItem(buildDefaultsKey(userId), JSON.stringify(payload));
  } catch {
    // ignore storage errors
  }
};
