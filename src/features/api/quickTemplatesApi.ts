import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import type { QuickTemplate } from "../../types/finance";

type AddQuickTemplateInput = Omit<QuickTemplate, "id">;
type UpdateQuickTemplateInput = QuickTemplate;

const mapQuickTemplate = (row: Record<string, unknown>): QuickTemplate => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  transaction_type:
    (row.transaction_type as QuickTemplate["transaction_type"]) ?? "expense",
  amount:
    row.amount === null || row.amount === undefined ? null : Number(row.amount),
  merchant: (row.merchant as string | null) ?? null,
  notes: (row.notes as string | null) ?? null,
  category_id: (row.category_id as string | null) ?? null,
  payment_method_id: (row.payment_method_id as string | null) ?? null,
  account_id: (row.account_id as string | null) ?? null,
});

const QUICK_TEMPLATE_SELECT =
  "id, name, transaction_type, amount, merchant, notes, category_id, payment_method_id, account_id";

export const quickTemplatesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getQuickTemplates: builder.query<QuickTemplate[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("quick_templates")
          .select(QUICK_TEMPLATE_SELECT)
          .order("name", { ascending: true })
          .order("created_at", { ascending: true });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return {
          data: (data ?? []).map((row) =>
            mapQuickTemplate(row as Record<string, unknown>),
          ),
        };
      },
      providesTags: (result) =>
        result
          ? [
              "QuickTemplates",
              ...result.map((template) => ({
                type: "QuickTemplates" as const,
                id: template.id,
              })),
            ]
          : ["QuickTemplates"],
    }),
    addQuickTemplate: builder.mutation<QuickTemplate, AddQuickTemplateInput>({
      async queryFn(input) {
        const { data, error } = await supabase
          .from("quick_templates")
          .insert(input)
          .select(QUICK_TEMPLATE_SELECT)
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: mapQuickTemplate(data as Record<string, unknown>) };
      },
      invalidatesTags: ["QuickTemplates"],
    }),
    updateQuickTemplate: builder.mutation<QuickTemplate, UpdateQuickTemplateInput>({
      async queryFn({ id, ...rest }) {
        const { data, error } = await supabase
          .from("quick_templates")
          .update(rest)
          .eq("id", id)
          .select(QUICK_TEMPLATE_SELECT)
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: mapQuickTemplate(data as Record<string, unknown>) };
      },
      invalidatesTags: ["QuickTemplates"],
    }),
    deleteQuickTemplate: builder.mutation<void, { id: string }>({
      async queryFn({ id }) {
        const { error } = await supabase
          .from("quick_templates")
          .delete()
          .eq("id", id);

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["QuickTemplates"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetQuickTemplatesQuery,
  useAddQuickTemplateMutation,
  useUpdateQuickTemplateMutation,
  useDeleteQuickTemplateMutation,
} = quickTemplatesApi;
