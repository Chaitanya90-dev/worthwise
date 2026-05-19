import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import type { Reconciliation } from "../../types/finance";
import type { DeleteByIdInput } from "./types";

type ReconciliationQuery = { accountId?: string };
type AddReconciliationInput = Omit<Reconciliation, "id">;

const mapReconciliation = (row: Record<string, unknown>): Reconciliation => ({
  id: String(row.id),
  account_id: String(row.account_id),
  statement_balance: Number(row.statement_balance ?? 0),
  statement_date: String(row.statement_date ?? ""),
  note: (row.note as string | null) ?? null,
  adjusted: Boolean(row.adjusted),
});

export const reconciliationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getReconciliations: builder.query<Reconciliation[], ReconciliationQuery>({
      async queryFn({ accountId } = {}) {
        let query = supabase
          .from("reconciliations")
          .select(
            "id, account_id, statement_balance, statement_date, note, adjusted"
          )
          .order("statement_date", { ascending: false });

        if (accountId) {
          query = query.eq("account_id", accountId);
        }

        const { data, error } = await query;

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return {
          data: (data ?? []).map((row) =>
            mapReconciliation(row as Record<string, unknown>)
          ),
        };
      },
      providesTags: (result) =>
        result
          ? [
              "Reconciliations",
              ...result.map((item) => ({
                type: "Reconciliations" as const,
                id: item.id,
              })),
            ]
          : ["Reconciliations"],
    }),
    addReconciliation: builder.mutation<Reconciliation, AddReconciliationInput>(
      {
        async queryFn(input) {
          const { data, error } = await supabase
            .from("reconciliations")
            .insert(input)
            .select(
              "id, account_id, statement_balance, statement_date, note, adjusted"
            )
            .single();

          if (error) {
            return { error: { message: normalizeApiErrorMessage(error) } };
          }

          return { data: mapReconciliation(data as Record<string, unknown>) };
        },
        invalidatesTags: ["Reconciliations", "Accounts"],
      }
    ),
    deleteReconciliation: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { error } = await supabase
          .from("reconciliations")
          .delete()
          .eq("id", id);

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Reconciliations"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetReconciliationsQuery,
  useAddReconciliationMutation,
  useDeleteReconciliationMutation,
} = reconciliationsApi;
