import { apiSlice } from "./baseApi";
import { supabase } from "../../lib/supabaseClient";
import { normalizeApiErrorMessage } from "../../lib/apiErrors";
import type { TelegramIngestEvent, TelegramIngestStatus } from "../../types/finance";

export type GetTelegramIngestEventsArgs = {
  limit?: number;
  status?: TelegramIngestStatus | "all";
};

export const telegramIngestApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTelegramIngestEvents: builder.query<
      TelegramIngestEvent[],
      GetTelegramIngestEventsArgs | void
    >({
      async queryFn(args) {
        const limit = args?.limit ?? 50;
        const status = args?.status ?? "all";

        let query = supabase
          .from("telegram_ingest_events")
          .select(
            "id, chat_id, message_text, parse_status, error_text, parsed_payload, transaction_id, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(limit);

        if (status !== "all") {
          query = query.eq("parse_status", status);
        }

        const { data, error } = await query;

        if (error) {
          return { error: { message: normalizeApiErrorMessage(error) } };
        }

        return { data: (data ?? []) as TelegramIngestEvent[] };
      },
    }),
  }),
  overrideExisting: false,
});

export const { useGetTelegramIngestEventsQuery } = telegramIngestApi;
