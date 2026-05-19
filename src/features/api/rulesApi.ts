import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import type { TransactionRule } from "../../types/finance";
import type { DeleteByIdInput } from "./types";

type AddRuleInput = Omit<TransactionRule, "id">;
type UpdateRuleInput = TransactionRule;

const mapRule = (row: Record<string, unknown>): TransactionRule => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  match_text: String(row.match_text ?? ""),
  match_type: (row.match_type as TransactionRule["match_type"]) ?? "contains",
  transaction_type:
    (row.transaction_type as TransactionRule["transaction_type"]) ?? "any",
  category_id: (row.category_id as string | null) ?? null,
  account_id: (row.account_id as string | null) ?? null,
  payment_method_id: (row.payment_method_id as string | null) ?? null,
  tag_names: (row.tag_names as string[]) ?? [],
  is_active: Boolean(row.is_active),
  priority: Number(row.priority ?? 100),
  new_merchant_name: (row.new_merchant_name as string | null) ?? null,
});

export const rulesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRules: builder.query<TransactionRule[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("rules")
          .select(
            "id, name, match_text, match_type, transaction_type, category_id, account_id, payment_method_id, tag_names, is_active, priority, new_merchant_name",
          )
          .order("priority", { ascending: true })
          .order("created_at", { ascending: true });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return {
          data: (data ?? []).map((row) =>
            mapRule(row as Record<string, unknown>),
          ),
        };
      },
      providesTags: (result) =>
        result
          ? [
              "Rules",
              ...result.map((rule) => ({
                type: "Rules" as const,
                id: rule.id,
              })),
            ]
          : ["Rules"],
    }),
    addRule: builder.mutation<TransactionRule, AddRuleInput>({
      async queryFn(input) {
        const { data, error } = await supabase
          .from("rules")
          .insert(input)
          .select(
            "id, name, match_text, match_type, transaction_type, category_id, account_id, payment_method_id, tag_names, is_active, priority, new_merchant_name",
          )
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: mapRule(data as Record<string, unknown>) };
      },
      invalidatesTags: ["Rules"],
    }),
    updateRule: builder.mutation<TransactionRule, UpdateRuleInput>({
      async queryFn({ id, ...rest }) {
        const { data, error } = await supabase
          .from("rules")
          .update(rest)
          .eq("id", id)
          .select(
            "id, name, match_text, match_type, transaction_type, category_id, account_id, payment_method_id, tag_names, is_active, priority, new_merchant_name",
          )
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: mapRule(data as Record<string, unknown>) };
      },
      invalidatesTags: ["Rules"],
    }),
    deleteRule: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { error } = await supabase.from("rules").delete().eq("id", id);

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Rules"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetRulesQuery,
  useAddRuleMutation,
  useUpdateRuleMutation,
  useDeleteRuleMutation,
} = rulesApi;
