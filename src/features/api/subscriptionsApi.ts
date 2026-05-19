import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import type { Subscription } from "../../types/finance";
import type { DeleteByIdInput } from "./types";

type AddSubscriptionInput = Omit<Subscription, "id">;
type UpdateSubscriptionInput = Subscription;

const mapSubscription = (row: Record<string, unknown>): Subscription => ({
  id: String(row.id),
  name: String(row.name ?? ""),
  amount: Number(row.amount ?? 0),
  currency: String(row.currency ?? "INR"),
  estimated_base_amount: Number(
    row.estimated_base_amount ?? row.last_billed_base_amount ?? row.amount ?? 0
  ),
  interval_months: Number(row.interval_months ?? 1),
  billing_anchor: String(row.billing_anchor ?? ""),
  next_due: String(row.next_due ?? ""),
  last_paid: row.last_paid ? String(row.last_paid) : null,
  last_billed_base_amount:
    row.last_billed_base_amount === null || row.last_billed_base_amount === undefined
      ? null
      : Number(row.last_billed_base_amount),
  last_fx_rate:
    row.last_fx_rate === null || row.last_fx_rate === undefined
      ? null
      : Number(row.last_fx_rate),
  status: (row.status as Subscription["status"]) ?? "active",
  category_id: (row.category_id as string | null) ?? null,
  account_id: (row.account_id as string | null) ?? null,
  payment_method_id: (row.payment_method_id as string | null) ?? null,
  notes: (row.notes as string | null) ?? null,
});

export const subscriptionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSubscriptions: builder.query<Subscription[], void>({
      async queryFn() {
        const { data, error } = await supabase
          .from("subscriptions")
          .select(
            "id, name, amount, currency, estimated_base_amount, interval_months, billing_anchor, next_due, last_paid, last_billed_base_amount, last_fx_rate, status, category_id, account_id, payment_method_id, notes"
          )
          .order("next_due", { ascending: true });

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return {
          data: (data ?? []).map((row) => mapSubscription(row as Record<string, unknown>)),
        };
      },
      providesTags: (result) =>
        result
          ? [
              "Subscriptions",
              ...result.map((subscription) => ({
                type: "Subscriptions" as const,
                id: subscription.id,
              })),
            ]
          : ["Subscriptions"],
    }),
    addSubscription: builder.mutation<Subscription, AddSubscriptionInput>({
      async queryFn(input) {
        const { data, error } = await supabase
          .from("subscriptions")
          .insert(input)
          .select(
            "id, name, amount, currency, estimated_base_amount, interval_months, billing_anchor, next_due, last_paid, last_billed_base_amount, last_fx_rate, status, category_id, account_id, payment_method_id, notes"
          )
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: mapSubscription(data as Record<string, unknown>) };
      },
      invalidatesTags: ["Subscriptions"],
    }),
    updateSubscription: builder.mutation<Subscription, UpdateSubscriptionInput>({
      async queryFn({ id, ...rest }) {
        const { data, error } = await supabase
          .from("subscriptions")
          .update(rest)
          .eq("id", id)
          .select(
            "id, name, amount, currency, estimated_base_amount, interval_months, billing_anchor, next_due, last_paid, last_billed_base_amount, last_fx_rate, status, category_id, account_id, payment_method_id, notes"
          )
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: mapSubscription(data as Record<string, unknown>) };
      },
      invalidatesTags: ["Subscriptions"],
    }),
    deleteSubscription: builder.mutation<void, DeleteByIdInput>({
      async queryFn({ id }) {
        const { error } = await supabase
          .from("subscriptions")
          .delete()
          .eq("id", id);

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: undefined };
      },
      invalidatesTags: ["Subscriptions"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useGetSubscriptionsQuery,
  useAddSubscriptionMutation,
  useUpdateSubscriptionMutation,
  useDeleteSubscriptionMutation,
} = subscriptionsApi;
