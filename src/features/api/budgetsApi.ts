import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import type { Budget } from "../../types/finance";
import type { DeleteByIdInput } from "./types";

type AddBudgetInput = Omit<Budget, "id">;
type UpdateBudgetInput = Budget;
type UpsertBudgetsInput = {
  month: string;
  items: Array<{ category_id: string | null; amount: number; rollover_enabled: boolean }>;
};

export const budgetsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBudgets: builder.query<Budget[], string>({
      async queryFn(month) {
        const { data, error } = await supabase
          .from("budgets")
          .select("id, month, amount, category_id, rollover_enabled")
          .eq("month", month)
          .order("amount", { ascending: false });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: (data ?? []) as Budget[] };
      },
      providesTags: (result) =>
        result
          ? [
              "Budgets",
              ...result.map((budget) => ({
                type: "Budgets" as const,
                id: budget.id,
              })),
            ]
          : ["Budgets"],
    }),
    addBudget: builder.mutation<Budget, AddBudgetInput>({
      async queryFn(budget) {
        const { data, error } = await supabase
          .from("budgets")
          .upsert(budget, { onConflict: "user_id,month,category_id" })
          .select("id, month, amount, category_id, rollover_enabled")
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: data as Budget };
      },
      invalidatesTags: ["Budgets"],
    }),
    updateBudget: builder.mutation<Budget, UpdateBudgetInput>({
      async queryFn(input) {
        const { id, ...rest } = input;
        const { data, error } = await supabase
          .from("budgets")
          .update(rest)
          .eq("id", id)
          .select("id, month, amount, category_id, rollover_enabled")
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: data as Budget };
      },
      invalidatesTags: ["Budgets"],
    }),
    deleteBudget: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { error } = await supabase.from("budgets").delete().eq("id", id);

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Budgets"],
    }),
    upsertBudgets: builder.mutation<Budget[], UpsertBudgetsInput>({
      async queryFn({ month, items }) {
        if (items.length === 0) {
          return { data: [] };
        }
        const payload = items.map((item) => ({ ...item, month }));
        const { data, error } = await supabase
          .from("budgets")
          .upsert(payload, { onConflict: "user_id,month,category_id" })
          .select("id, month, amount, category_id, rollover_enabled");

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: (data ?? []) as Budget[] };
      },
      invalidatesTags: ["Budgets"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetBudgetsQuery,
  useAddBudgetMutation,
  useUpdateBudgetMutation,
  useDeleteBudgetMutation,
  useUpsertBudgetsMutation,
} = budgetsApi;
