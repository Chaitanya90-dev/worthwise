import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import type { SharedExpense, Tag, Transaction } from "../../types/finance";

type TransactionRow = {
  id: string;
  type: "expense" | "income";
  date: string;
  amount: number;
  category_id: string | null;
  reimbursement_category_id: string | null;
  reimbursement_of_transaction_id: string | null;
  payment_method_id: string | null;
  account_id: string | null;
  counterparty_name: string | null;
  counterparty_kind: Transaction["counterparty_kind"];
  merchant: string | null;
  notes_enc: string | null;
  is_recurring: boolean;
  is_transfer: boolean | null;
  transfer_group_id: string | null;
  is_reimbursement: boolean | null;
  is_shared: boolean | null;
  transaction_tags?: Array<{ tags: Tag | Tag[] | null }>;
};

type SharedExpenseRow = {
  id: string;
  transaction_id: string;
  transactions: TransactionRow | null;
  shared_participants: Array<{
    id: string;
    name: string;
    share_amount: number;
  }> | null;
  shared_reimbursements: Array<{
    id: string;
    participant_id: string | null;
    transaction_id: string;
    transactions: TransactionRow | null;
  }> | null;
};

const mapTransactionRow = (row: TransactionRow | null): Transaction | null => {
  if (!row) {
    return null;
  }
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
  };
};

export const sharedApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSharedExpenses: builder.query<SharedExpense[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("shared_expenses")
          .select(
            "id, transaction_id, transactions(id, type, date, amount, category_id, reimbursement_category_id, reimbursement_of_transaction_id, payment_method_id, account_id, counterparty_name, counterparty_kind, merchant, notes_enc, is_recurring, is_transfer, transfer_group_id, is_reimbursement, is_shared, transaction_tags(tags(id, name))), shared_participants(id, name, share_amount), shared_reimbursements(id, participant_id, transaction_id, transactions(id, type, date, amount, category_id, reimbursement_category_id, reimbursement_of_transaction_id, payment_method_id, account_id, counterparty_name, counterparty_kind, merchant, notes_enc, is_recurring, is_transfer, transfer_group_id, is_reimbursement, is_shared))"
          )
          .order("created_at", { ascending: false });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        const rows = (data ?? []) as unknown as SharedExpenseRow[];
        const sharedExpenses = rows
          .map((row) => {
            const transaction = mapTransactionRow(row.transactions);
            if (!transaction) {
              return null;
            }
            const participants =
              row.shared_participants?.map((participant) => ({
                id: participant.id,
                name: participant.name,
                share_amount: Number(participant.share_amount),
              })) ?? [];
            const reimbursements =
              row.shared_reimbursements?.flatMap((reimbursement) => {
                const tx = mapTransactionRow(reimbursement.transactions);
                if (!tx) {
                  return [];
                }
                return [
                  {
                    id: reimbursement.id,
                    transaction_id: reimbursement.transaction_id,
                    participant_id: reimbursement.participant_id ?? null,
                    transaction: tx,
                  },
                ];
              }) ?? [];
            return {
              id: row.id,
              transaction_id: row.transaction_id,
              transaction,
              participants,
              reimbursements,
            } as SharedExpense;
          })
          .filter((item): item is SharedExpense => Boolean(item));

        return { data: sharedExpenses };
      },
      providesTags: ["SharedExpenses"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetSharedExpensesQuery } = sharedApi;
