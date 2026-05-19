import dayjs from "dayjs";
import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import {
  enqueueOfflineTransaction,
  getOfflineTransactionQueueCount,
  isLikelyNetworkError,
} from "../../lib/offlineTransactionQueue";
import type { QueuedTransactionPayload } from "../../lib/offlineTransactionQueue";
import { resolveCounterpartyFields } from "../../lib/counterparty";
import { getBaseCurrency } from "../../lib/moneyConfig";
import type { Tag, Transaction } from "../../types/finance";
import { setOnlineStatus, setPendingCount } from "../offline/offlineQueueSlice";
import type { DeleteByIdInput, MonthArgs, RangeArgs, TagsArgs } from "./types";

type TransactionRow = {
  id: string;
  type: "expense" | "income";
  date: string;
  amount: number;
  currency: string;
  category_id: string | null;
  payment_method_id: string | null;
  account_id: string | null;
  counterparty_name: string | null;
  counterparty_kind: Transaction["counterparty_kind"];
  merchant: string | null;
  notes_enc: string | null;
  is_transfer: boolean | null;
  transfer_group_id: string | null;
  is_reimbursement: boolean | null;
  is_shared: boolean | null;
  reimbursement_category_id: string | null;
  reimbursement_of_transaction_id: string | null;
  is_recurring: boolean;
  transaction_tags?: Array<{ tags: Tag | Tag[] | null }>;
};

export type AddTransactionInput = Omit<Transaction, "id" | "tags" | "notes_enc"> & {
  notes?: string | null;
  tags?: string[];
  sharedSplit?: SharedSplitInput | null;
  sharedReimbursement?: SharedReimbursementInput | null;
  offlineQueue?: "allow" | "disallow";
};

type UpdateTransactionInput = Omit<Transaction, "tags" | "notes_enc"> & {
  notes?: string | null;
  tags?: string[];
  sharedSplit?: SharedSplitInput | null;
  sharedReimbursement?: SharedReimbursementInput | null;
};

type SharedSplitInput = {
  participants: Array<{
    id?: string;
    name: string;
    share_amount: number;
  }>;
};

type SharedReimbursementInput = {
  shared_expense_id: string;
  participant_id: string | null;
};

type PersistedAddTransactionInput = Omit<AddTransactionInput, "offlineQueue">;

const normalizeTags = (tags: string[]) =>
  tags
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.toLowerCase());

const upsertSharedExpense = async (
  transactionId: string,
  participants: SharedSplitInput["participants"]
) => {
  const { data: sharedExpense, error } = await supabase
    .from("shared_expenses")
    .upsert({ transaction_id: transactionId }, { onConflict: "transaction_id" })
    .select("id")
    .single();

  if (error) {
    return { error: { message: normalizeApiErrorMessage(error) } };
  }

  const { error: deleteError } = await supabase
    .from("shared_participants")
    .delete()
    .eq("shared_expense_id", sharedExpense.id);

  if (deleteError) {
    return { error: deleteError };
  }

  const sanitized = participants
    .map((participant) => ({
      name: participant.name.trim(),
      share_amount: Number(participant.share_amount),
    }))
    .filter(
      (participant) =>
        participant.name && !Number.isNaN(participant.share_amount)
    );

  if (sanitized.length > 0) {
    const { error: insertError } = await supabase
      .from("shared_participants")
      .insert(
        sanitized.map((participant) => ({
          shared_expense_id: sharedExpense.id,
          name: participant.name,
          share_amount: participant.share_amount,
        }))
      );

    if (insertError) {
      return { error: insertError };
    }
  }

  return { data: sharedExpense };
};

const clearSharedExpense = async (transactionId: string) =>
  supabase.from("shared_expenses").delete().eq("transaction_id", transactionId);

const upsertSharedReimbursement = async (
  transactionId: string,
  input: SharedReimbursementInput
) =>
  supabase.from("shared_reimbursements").upsert(
    {
      transaction_id: transactionId,
      shared_expense_id: input.shared_expense_id,
      participant_id: input.participant_id,
    },
    { onConflict: "transaction_id" }
  );

const clearSharedReimbursement = async (transactionId: string) =>
  supabase
    .from("shared_reimbursements")
    .delete()
    .eq("transaction_id", transactionId);

const mapTransactionRows = async (rows: TransactionRow[]) =>
  Promise.all(
    rows.map(async (row) => {
      const tags = row.transaction_tags
        ? row.transaction_tags.flatMap((link) => {
            if (!link.tags) {
              return [];
            }
            return Array.isArray(link.tags) ? link.tags : [link.tags];
          })
        : [];
      return {
        id: row.id,
        type: row.type,
        date: row.date,
        amount: Number(row.amount),
        currency: row.currency,
        category_id: row.category_id,
        reimbursement_category_id: row.reimbursement_category_id,
        reimbursement_of_transaction_id: row.reimbursement_of_transaction_id,
        payment_method_id: row.payment_method_id,
        account_id: row.account_id,
        counterparty_name: row.counterparty_name ?? row.merchant ?? null,
        counterparty_kind: row.counterparty_kind ?? null,
        merchant: row.merchant ?? null,
        notes: row.notes_enc ?? null,
        notes_enc: row.notes_enc,
        is_transfer: Boolean(row.is_transfer),
        transfer_group_id: row.transfer_group_id,
        is_reimbursement: Boolean(row.is_reimbursement),
        is_shared: Boolean(row.is_shared),
        is_recurring: row.is_recurring,
        tags,
      } as Transaction;
    })
  );

const isBrowserOnline = () => {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
};

const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);

const normalizeQueuedTagNames = (tags?: string[]) =>
  normalizeTags(tags ?? []).map((name, index) => ({
    id: `offline-tag-${index + 1}-${name}`,
    name,
  }));

const toQueuePayload = (
  input: PersistedAddTransactionInput,
): QueuedTransactionPayload => ({
  type: input.type,
  date: input.date,
  amount: Number(input.amount),
  currency: input.currency ?? getBaseCurrency(),
  category_id: input.category_id,
  reimbursement_category_id: input.reimbursement_category_id ?? null,
  reimbursement_of_transaction_id: input.reimbursement_of_transaction_id ?? null,
  payment_method_id: input.payment_method_id,
  account_id: input.account_id ?? null,
  counterparty_name: input.counterparty_name ?? input.merchant ?? null,
  counterparty_kind: input.counterparty_kind ?? null,
  merchant: input.merchant ?? null,
  notes: input.notes ?? null,
  tags: input.tags ?? [],
  is_transfer: input.is_transfer ?? false,
  transfer_group_id: input.transfer_group_id ?? null,
  is_reimbursement: input.is_reimbursement ?? false,
  is_shared: input.is_shared ?? false,
  is_recurring: input.is_recurring,
  sharedSplit: input.sharedSplit ?? null,
  sharedReimbursement: input.sharedReimbursement ?? null,
});

const buildQueuedTransaction = ({
  queueId,
  input,
}: {
  queueId: string;
  input: PersistedAddTransactionInput;
}): Transaction => ({
  id: `offline:${queueId}`,
  type: input.type,
  date: input.date,
  amount: Number(input.amount),
  currency: input.currency ?? getBaseCurrency(),
  category_id: input.category_id,
  reimbursement_category_id: input.reimbursement_category_id ?? null,
  reimbursement_of_transaction_id: input.reimbursement_of_transaction_id ?? null,
  payment_method_id: input.payment_method_id,
  account_id: input.account_id ?? null,
  counterparty_name: input.counterparty_name ?? input.merchant ?? null,
  counterparty_kind: input.counterparty_kind ?? null,
  merchant: input.merchant ?? null,
  notes: input.notes ?? null,
  notes_enc: input.notes ?? null,
  is_transfer: input.is_transfer ?? false,
  transfer_group_id: input.transfer_group_id ?? null,
  is_reimbursement: input.is_reimbursement ?? false,
  is_shared: input.is_shared ?? false,
  is_recurring: input.is_recurring,
  tags: normalizeQueuedTagNames(input.tags),
});

const getCurrentUserId = async () => {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
};

const resolveTransactionCurrency = async (
  accountId?: string | null,
  explicitCurrency?: string | null,
) => {
  if (explicitCurrency?.trim()) {
    return explicitCurrency.trim().toUpperCase();
  }

  if (accountId) {
    const { data, error } = await supabase
      .from("accounts")
      .select("currency")
      .eq("id", accountId)
      .maybeSingle();

    if (!error && data?.currency) {
      return String(data.currency).toUpperCase();
    }
  }

  return getBaseCurrency();
};

export const submitTransactionOnline = async (
  input: PersistedAddTransactionInput,
): Promise<{ data: Transaction } | { error: { message: string } }> => {
  const {
    tags,
    notes,
    counterparty_name,
    counterparty_kind,
    merchant,
    sharedSplit,
    sharedReimbursement,
    ...insertInput
  } = input;

  const notes_enc = notes || null;
  const counterparty = resolveCounterpartyFields({
    counterpartyName: counterparty_name,
    counterpartyKind: counterparty_kind,
    merchant,
  });
  const currency = await resolveTransactionCurrency(
    insertInput.account_id ?? null,
    insertInput.currency ?? null,
  );

  const { data: inserted, error } = await supabase
    .from("transactions")
    .insert({
      ...insertInput,
      currency,
      counterparty_name: counterparty.counterparty_name,
      counterparty_kind: counterparty.counterparty_kind,
      merchant: counterparty.merchant,
      notes_enc,
      is_transfer: insertInput.is_transfer ?? false,
      is_reimbursement: insertInput.is_reimbursement ?? false,
      is_shared: insertInput.is_shared ?? false,
      reimbursement_category_id: insertInput.reimbursement_category_id ?? null,
      reimbursement_of_transaction_id:
        insertInput.reimbursement_of_transaction_id ?? null,
    })
    .select(
      "id, type, date, amount, currency, category_id, reimbursement_category_id, reimbursement_of_transaction_id, payment_method_id, account_id, counterparty_name, counterparty_kind, merchant, notes_enc, is_recurring, is_transfer, transfer_group_id, is_reimbursement, is_shared",
    )
    .single();

  if (error) {
    return { error: { message: normalizeApiErrorMessage(error) } };
  }

  let linkedTags: Tag[] = [];
  const tagList = tags ? normalizeTags(tags) : [];

  if (tagList.length > 0) {
    const { data: tagRows, error: tagError } = await supabase
      .from("tags")
      .upsert(
        tagList.map((name) => ({ name })),
        { onConflict: "user_id,name" },
      )
      .select("id, name");

    if (tagError) {
      return { error: { message: normalizeApiErrorMessage(tagError) } };
    }

    linkedTags = (tagRows ?? []) as Tag[];

    if (linkedTags.length > 0) {
      const linkRows = linkedTags.map((tag) => ({
        tag_id: tag.id,
        transaction_id: inserted.id,
      }));
      const { error: linkError } = await supabase
        .from("transaction_tags")
        .insert(linkRows);

      if (linkError) {
        return { error: { message: normalizeApiErrorMessage(linkError) } };
      }
    }
  }

  const shouldSaveSharedSplit =
    insertInput.type === "expense" && insertInput.is_shared && sharedSplit;
  if (shouldSaveSharedSplit) {
    const { error: sharedError } = await upsertSharedExpense(
      inserted.id,
      sharedSplit.participants,
    );

    if (sharedError) {
      return { error: { message: normalizeApiErrorMessage(sharedError) } };
    }
  }

  const shouldSaveReimbursement =
    insertInput.type === "income" &&
    insertInput.is_reimbursement &&
    sharedReimbursement?.shared_expense_id;
  if (shouldSaveReimbursement) {
    const { error: reimbursementError } = await upsertSharedReimbursement(
      inserted.id,
      {
        shared_expense_id: sharedReimbursement.shared_expense_id,
        participant_id: sharedReimbursement.participant_id ?? null,
      },
    );

    if (reimbursementError) {
      return { error: { message: normalizeApiErrorMessage(reimbursementError) } };
    }
  }

  return {
    data: {
      id: inserted.id,
      type: inserted.type,
      date: inserted.date,
      amount: Number(inserted.amount),
      currency: inserted.currency,
      category_id: inserted.category_id,
      reimbursement_category_id: inserted.reimbursement_category_id,
      reimbursement_of_transaction_id: inserted.reimbursement_of_transaction_id,
      payment_method_id: inserted.payment_method_id,
      account_id: inserted.account_id,
      counterparty_name: inserted.counterparty_name ?? inserted.merchant ?? null,
      counterparty_kind: inserted.counterparty_kind ?? null,
      merchant: inserted.merchant ?? null,
      notes: inserted.notes_enc ?? null,
      notes_enc: inserted.notes_enc,
      is_transfer: inserted.is_transfer ?? false,
      transfer_group_id: inserted.transfer_group_id,
      is_reimbursement: inserted.is_reimbursement ?? false,
      is_shared: inserted.is_shared ?? false,
      is_recurring: inserted.is_recurring,
      tags: linkedTags,
    },
  };
};

export const transactionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTransactions: builder.query<Transaction[], MonthArgs>({
      async queryFn({ month }) {
        const start = dayjs(`${month}-01`).startOf("month");
        const end = dayjs(`${month}-01`).endOf("month");

        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id, type, date, amount, currency, category_id, reimbursement_category_id, reimbursement_of_transaction_id, payment_method_id, account_id, counterparty_name, counterparty_kind, merchant, notes_enc, is_recurring, is_transfer, transfer_group_id, is_reimbursement, is_shared, transaction_tags(tags(id, name))"
          )
          .gte("date", start.format("YYYY-MM-DD"))
          .lte("date", end.format("YYYY-MM-DD"))
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        const rows = (data ?? []) as unknown as TransactionRow[];

        return { data: await mapTransactionRows(rows) };
      },
      providesTags: (result) =>
        result
          ? [
              "Transactions",
              ...result.map((transaction) => ({
                type: "Transactions" as const,
                id: transaction.id,
              })),
            ]
          : ["Transactions"],
    }),
    getTransactionsByRange: builder.query<Transaction[], RangeArgs>({
      async queryFn({ start, end }) {
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id, type, date, amount, currency, category_id, reimbursement_category_id, reimbursement_of_transaction_id, payment_method_id, account_id, counterparty_name, counterparty_kind, merchant, notes_enc, is_recurring, is_transfer, transfer_group_id, is_reimbursement, is_shared, transaction_tags(tags(id, name))"
          )
          .gte("date", start)
          .lte("date", end)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        const rows = (data ?? []) as unknown as TransactionRow[];
        return { data: await mapTransactionRows(rows) };
      },
      providesTags: (result) =>
        result
          ? [
              "Transactions",
              ...result.map((transaction) => ({
                type: "Transactions" as const,
                id: transaction.id,
              })),
            ]
          : ["Transactions"],
    }),
    getRecurringTransactions: builder.query<Transaction[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("transactions")
          .select(
            "id, type, date, amount, currency, category_id, reimbursement_category_id, reimbursement_of_transaction_id, payment_method_id, account_id, counterparty_name, counterparty_kind, merchant, notes_enc, is_recurring, is_transfer, transfer_group_id, is_reimbursement, is_shared, transaction_tags(tags(id, name))"
          )
          .eq("is_recurring", true)
          .order("date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        const rows = (data ?? []) as unknown as TransactionRow[];
        return { data: await mapTransactionRows(rows) };
      },
      providesTags: (result) =>
        result
          ? [
              "Transactions",
              ...result.map((transaction) => ({
                type: "Transactions" as const,
                id: transaction.id,
              })),
            ]
          : ["Transactions"],
    }),
    addTransaction: builder.mutation<Transaction, AddTransactionInput>({
      async queryFn({ offlineQueue = "allow", ...input }, { dispatch }) {
        const allowOfflineQueue =
          offlineQueue !== "disallow" && !input.is_transfer;
        const userId = await getCurrentUserId();

        const queueAndReturn = async () => {
          const queued = await enqueueOfflineTransaction({
            payload: toQueuePayload(input),
            userId,
          });
          const pendingCount = await getOfflineTransactionQueueCount({
            userId: userId ?? undefined,
          });
          dispatch(setPendingCount(pendingCount));
          return {
            data: buildQueuedTransaction({
              queueId: queued.id,
              input,
            }),
          } satisfies { data: Transaction };
        };

        if (!isBrowserOnline()) {
          if (allowOfflineQueue) {
            try {
              return await queueAndReturn();
            } catch (queueError) {
              return {
                error: {
                  message: `Unable to queue offline transaction: ${toErrorMessage(queueError)}`,
                },
              };
            }
          }
          return {
            error: {
              message:
                "This action needs an internet connection because it updates multiple records.",
            },
          };
        }

        const result = await submitTransactionOnline(input);
        if ("data" in result) {
          dispatch(setOnlineStatus(true));
          return result;
        }

        if (allowOfflineQueue && isLikelyNetworkError(result.error.message)) {
          try {
            return await queueAndReturn();
          } catch (queueError) {
            return {
              error: {
                message: `Unable to queue offline transaction: ${toErrorMessage(queueError)}`,
              },
            };
          }
        }

        return result;
      },
      invalidatesTags: (result) =>
        result?.id?.startsWith("offline:")
          ? []
          : ["Transactions", "Accounts", "SharedExpenses"],
    }),
    updateTransaction: builder.mutation<Transaction, UpdateTransactionInput>({
      async queryFn({
        id,
        tags,
        notes,
        counterparty_name,
        counterparty_kind,
        merchant,
        sharedSplit,
        sharedReimbursement,
        ...input
      }) {
        const notes_enc = notes || null;
        const counterparty = resolveCounterpartyFields({
          counterpartyName: counterparty_name,
          counterpartyKind: counterparty_kind,
          merchant,
        });
        const updateValues = {
          ...input,
          ...(merchant !== undefined ||
          counterparty_name !== undefined ||
          counterparty_kind !== undefined
            ? {
                merchant: counterparty.merchant,
                counterparty_name: counterparty.counterparty_name,
                counterparty_kind: counterparty.counterparty_kind,
              }
            : {}),
          ...(notes !== undefined ? { notes_enc } : {}),
          is_transfer: input.is_transfer ?? false,
          is_reimbursement: input.is_reimbursement ?? false,
          is_shared: input.is_shared ?? false,
          reimbursement_category_id: input.reimbursement_category_id ?? null,
          reimbursement_of_transaction_id:
            input.reimbursement_of_transaction_id ?? null,
        };
        updateValues.currency = await resolveTransactionCurrency(
          input.account_id ?? null,
          input.currency ?? null,
        );

        const { data: updated, error } = await supabase
          .from("transactions")
          .update(updateValues)
          .eq("id", id)
          .select(
            "id, type, date, amount, currency, category_id, reimbursement_category_id, reimbursement_of_transaction_id, payment_method_id, account_id, counterparty_name, counterparty_kind, merchant, notes_enc, is_recurring, is_transfer, transfer_group_id, is_reimbursement, is_shared"
          )
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        const { error: deleteError } = await supabase
          .from("transaction_tags")
          .delete()
          .eq("transaction_id", id);

        if (deleteError) {
          return { error: { message: normalizeApiErrorMessage(deleteError) } };
        }

        let linkedTags: Tag[] = [];
        const tagList = tags ? normalizeTags(tags) : [];

        if (tagList.length > 0) {
          const { data: tagRows, error: tagError } = await supabase
            .from("tags")
            .upsert(
              tagList.map((name) => ({ name })),
              { onConflict: "user_id,name" }
            )
            .select("id, name");

          if (tagError) {
            return { error: { message: normalizeApiErrorMessage(tagError) } };
          }

          linkedTags = (tagRows ?? []) as Tag[];

          if (linkedTags.length > 0) {
            const linkRows = linkedTags.map((tag) => ({
              tag_id: tag.id,
              transaction_id: updated.id,
            }));

            const { error: linkError } = await supabase
              .from("transaction_tags")
              .insert(linkRows);

            if (linkError) {
              return { error: { message: normalizeApiErrorMessage(linkError) } };
            }
          }
        }

        const shouldSaveSharedSplit =
          input.type === "expense" && input.is_shared && sharedSplit;
        if (shouldSaveSharedSplit) {
          const { error: sharedError } = await upsertSharedExpense(
            updated.id,
            sharedSplit.participants
          );

          if (sharedError) {
            return { error: { message: normalizeApiErrorMessage(sharedError) } };
          }
        } else if (!input.is_shared || input.type !== "expense") {
          const { error: clearError } = await clearSharedExpense(updated.id);
          if (clearError) {
            return { error: { message: normalizeApiErrorMessage(clearError) } };
          }
        }

        if (sharedReimbursement !== undefined) {
          const shouldSaveReimbursement =
            input.type === "income" &&
            input.is_reimbursement &&
            sharedReimbursement?.shared_expense_id;
          if (shouldSaveReimbursement) {
            const { error: reimbursementError } = await upsertSharedReimbursement(
              updated.id,
              {
                shared_expense_id: sharedReimbursement.shared_expense_id,
                participant_id: sharedReimbursement.participant_id ?? null,
              }
            );

            if (reimbursementError) {
              return { error: { message: normalizeApiErrorMessage(reimbursementError) } };
            }
          } else {
            const { error: clearError } = await clearSharedReimbursement(updated.id);
            if (clearError) {
              return { error: { message: normalizeApiErrorMessage(clearError) } };
            }
          }
        }

        return {
          data: {
            id: updated.id,
            type: updated.type,
            date: updated.date,
            amount: Number(updated.amount),
            currency: updated.currency,
            category_id: updated.category_id,
            reimbursement_category_id: updated.reimbursement_category_id,
            reimbursement_of_transaction_id:
              updated.reimbursement_of_transaction_id,
            payment_method_id: updated.payment_method_id,
            account_id: updated.account_id,
            counterparty_name: updated.counterparty_name ?? updated.merchant ?? null,
            counterparty_kind: updated.counterparty_kind ?? null,
            merchant: updated.merchant ?? null,
            notes: updated.notes_enc ?? null,
            notes_enc: updated.notes_enc,
            is_transfer: updated.is_transfer ?? false,
            transfer_group_id: updated.transfer_group_id,
            is_reimbursement: updated.is_reimbursement ?? false,
            is_shared: updated.is_shared ?? false,
            is_recurring: updated.is_recurring,
            tags: linkedTags,
          },
        };
      },
      invalidatesTags: ["Transactions", "Accounts", "SharedExpenses"],
    }),
    deleteTransaction: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("id", id);

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Transactions", "Accounts", "SharedExpenses"],
    }),
    replaceTransactionTags: builder.mutation<void, TagsArgs>({
      async queryFn({ transactionId, tags }) {
        const normalized = normalizeTags(tags);

        const { error: deleteError } = await supabase
          .from("transaction_tags")
          .delete()
          .eq("transaction_id", transactionId);

        if (deleteError) {
          return { error: { message: normalizeApiErrorMessage(deleteError) } };
        }

        if (normalized.length === 0) {
          return { data: undefined };
        }

        const { data: tagRows, error: tagError } = await supabase
          .from("tags")
          .upsert(
            normalized.map((name) => ({ name })),
            {
              onConflict: "user_id,name",
            }
          )
          .select("id, name");

        if (tagError) {
          return { error: { message: normalizeApiErrorMessage(tagError) } };
        }

        const linkRows = (tagRows ?? []).map((tag) => ({
          tag_id: tag.id,
          transaction_id: transactionId,
        }));

        const { error: linkError } = await supabase
          .from("transaction_tags")
          .insert(linkRows);

        if (linkError) {
          return { error: { message: normalizeApiErrorMessage(linkError) } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Transactions"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetTransactionsQuery,
  useGetTransactionsByRangeQuery,
  useGetRecurringTransactionsQuery,
  useAddTransactionMutation,
  useUpdateTransactionMutation,
  useDeleteTransactionMutation,
  useReplaceTransactionTagsMutation,
} = transactionsApi;
