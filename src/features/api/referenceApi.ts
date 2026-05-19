import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import type { Category, PaymentMethod, Tag } from "../../types/finance";

export const referenceApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCategories: builder.query<Category[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("categories")
          .select("id, name, parent_id, type")
          .order("name");

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: (data ?? []) as Category[] };
      },
      providesTags: ["Categories"],
    }),
    addCategory: builder.mutation<
      Category,
      { name: string; type: Category["type"]; parent_id: string | null }
    >({
      async queryFn(body) {
        const { data, error } = await supabase
          .from("categories")
          .insert(body)
          .select("id, name, parent_id, type")
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: data as Category };
      },
      invalidatesTags: ["Categories", "Budgets", "Transactions"],
    }),
    updateCategory: builder.mutation<
      Category,
      { id: string; name: string; type: Category["type"]; parent_id: string | null }
    >({
      async queryFn({ id, ...input }) {
        const { data, error } = await supabase
          .from("categories")
          .update(input)
          .eq("id", id)
          .select("id, name, parent_id, type")
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: data as Category };
      },
      invalidatesTags: ["Categories", "Budgets", "Transactions"],
    }),
    deleteCategory: builder.mutation<void, { id: string }>({
      async queryFn({ id }) {
        const { error } = await supabase.from("categories").delete().eq("id", id);
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }
        return { data: undefined };
      },
      invalidatesTags: ["Categories", "Budgets", "Transactions"],
    }),
    getPaymentMethods: builder.query<PaymentMethod[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("payment_methods")
          .select("id, name")
          .order("name");

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: (data ?? []) as PaymentMethod[] };
      },
      providesTags: ["PaymentMethods"],
    }),
    addPaymentMethod: builder.mutation<PaymentMethod, { name: string }>({
      async queryFn(body) {
        const { data, error } = await supabase
          .from("payment_methods")
          .insert(body)
          .select("id, name")
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: data as PaymentMethod };
      },
      invalidatesTags: ["PaymentMethods", "Transactions"],
    }),
    updatePaymentMethod: builder.mutation<PaymentMethod, { id: string; name: string }>(
      {
        async queryFn({ id, ...input }) {
          const { data, error } = await supabase
            .from("payment_methods")
            .update(input)
            .eq("id", id)
            .select("id, name")
            .single();

          if (error) {
            return { error: { message: normalizeApiErrorMessage(error) } };
          }

          return { data: data as PaymentMethod };
        },
        invalidatesTags: ["PaymentMethods", "Transactions"],
      }
    ),
    deletePaymentMethod: builder.mutation<void, { id: string }>({
      async queryFn({ id }) {
        const { error } = await supabase
          .from("payment_methods")
          .delete()
          .eq("id", id);
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }
        return { data: undefined };
      },
      invalidatesTags: ["PaymentMethods", "Transactions"],
    }),
    getTags: builder.query<Tag[], void>({
      async queryFn() {
        const { data, error } = await supabase.from("tags").select("id, name").order("name");
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }
        return { data: (data ?? []) as Tag[] };
      },
      providesTags: ["Tags"],
    }),
    addTag: builder.mutation<Tag, { name: string }>({
      async queryFn(body) {
        const { data, error } = await supabase
          .from("tags")
          .insert(body)
          .select("id, name")
          .single();
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }
        return { data: data as Tag };
      },
      invalidatesTags: ["Tags", "Transactions"],
    }),
    updateTag: builder.mutation<Tag, { id: string; name: string }>({
      async queryFn({ id, ...input }) {
        const { data, error } = await supabase
          .from("tags")
          .update(input)
          .eq("id", id)
          .select("id, name")
          .single();
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }
        return { data: data as Tag };
      },
      invalidatesTags: ["Tags", "Transactions"],
    }),
    deleteTag: builder.mutation<void, { id: string }>({
      async queryFn({ id }) {
        const { error } = await supabase.from("tags").delete().eq("id", id);
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }
        return { data: undefined };
      },
      invalidatesTags: ["Tags", "Transactions"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetCategoriesQuery,
  useGetPaymentMethodsQuery,
  useGetTagsQuery,
  useAddCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
  useAddPaymentMethodMutation,
  useUpdatePaymentMethodMutation,
  useDeletePaymentMethodMutation,
  useAddTagMutation,
  useUpdateTagMutation,
  useDeleteTagMutation,
} = referenceApi;
