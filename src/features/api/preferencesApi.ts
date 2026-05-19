import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import type { UserPreferences } from "../../types/finance";

type UpsertPreferencesInput = {
  user_id: string;
  weekly_summary_enabled: boolean;
  weekly_summary_day: number;
  weekly_summary_time: string;
  weekly_summary_timezone: string;
  locale: string;
  base_currency: string;
  display_currency: string;
  exchange_rates: Record<string, number>;
  telegram_chat_id?: number | null;
};

export const preferencesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPreferences: builder.query<UserPreferences | null, string>({
      async queryFn(userId) {
        if (!userId) {
          return { data: null };
        }
        const { data, error } = await supabase
          .from("user_preferences")
          .select(
            "user_id, weekly_summary_enabled, weekly_summary_day, weekly_summary_time, weekly_summary_timezone, locale, base_currency, display_currency, exchange_rates, weekly_summary_last_sent_at, is_readonly, telegram_chat_id",
          )
          .eq("user_id", userId)
          .maybeSingle();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        if (!data) {
          return { data: null };
        }

        return { data: data as UserPreferences };
      },
      providesTags: ["Preferences"],
    }),
    upsertPreferences: builder.mutation<
      UserPreferences,
      UpsertPreferencesInput
    >({
      async queryFn(input) {
        const { data, error } = await supabase
          .from("user_preferences")
          .upsert(input, { onConflict: "user_id" })
          .select(
            "user_id, weekly_summary_enabled, weekly_summary_day, weekly_summary_time, weekly_summary_timezone, locale, base_currency, display_currency, exchange_rates, weekly_summary_last_sent_at, is_readonly, telegram_chat_id",
          )
          .single();

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: data as UserPreferences };
      },
      invalidatesTags: ["Preferences"],
    }),
  }),
  overrideExisting: false,
});

export const { useGetPreferencesQuery, useUpsertPreferencesMutation } =
  preferencesApi;
