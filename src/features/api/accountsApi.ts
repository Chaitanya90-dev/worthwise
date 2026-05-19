import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import { getBaseCurrency } from "../../lib/moneyConfig";
import type { Account } from "../../types/finance";

type AccountInput = Omit<Account, "id" | "current_balance" | "currency"> & {
  current_balance?: number;
  currency?: string;
};

export const accountsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAccounts: builder.query<Account[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("accounts")
          .select("id, name, type, current_balance, currency")
          .order("created_at", { ascending: true });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return {
          data: (data ?? []).map((row) => ({
            ...row,
            current_balance: Number(row.current_balance ?? 0),
          })) as Account[],
        };
      },
      providesTags: (result) =>
        result
          ? [
              "Accounts",
              ...result.map((item) => ({ type: "Accounts" as const, id: item.id })),
            ]
          : ["Accounts"],
    }),
    addAccount: builder.mutation<Account, AccountInput>({
      async queryFn(input) {
        const { data, error } = await supabase
          .from("accounts")
          .insert({
            name: input.name,
            type: input.type,
            current_balance: input.current_balance ?? 0,
            currency: input.currency ?? getBaseCurrency(),
          })
          .select("id, name, type, current_balance, currency")
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return {
          data: {
            ...data,
            current_balance: Number(data.current_balance ?? 0),
          } as Account,
        };
      },
      invalidatesTags: ["Accounts"],
    }),
    updateAccount: builder.mutation<Account, AccountInput & { id: string }>({
      async queryFn({ id, ...input }) {
        const { data, error } = await supabase
          .from("accounts")
          .update({
            name: input.name,
            type: input.type,
            current_balance: input.current_balance ?? 0,
            currency: input.currency ?? getBaseCurrency(),
          })
          .eq("id", id)
          .select("id, name, type, current_balance, currency")
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return {
          data: {
            ...data,
            current_balance: Number(data.current_balance ?? 0),
          } as Account,
        };
      },
      invalidatesTags: ["Accounts"],
    }),
    deleteAccount: builder.mutation<{ id: string }, { id: string }>({
      async queryFn({ id }) {
        const { error } = await supabase.from("accounts").delete().eq("id", id);
        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }
        return { data: { id } };
      },
      invalidatesTags: ["Accounts"],
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useAddAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
} = accountsApi;
