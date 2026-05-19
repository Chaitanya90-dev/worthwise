import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export type DemoLoginSession = {
  access_token: string;
  refresh_token: string;
  expires_at?: number | null;
  expires_in?: number | null;
  token_type?: string | null;
  user?: unknown;
};

export const normalizeDemoLoginError = (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    return "Demo login is not available right now.";
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }
  return "Demo login is not available right now.";
};

export const requestDemoSession = async () => {
  const { data, error } = await supabase.functions.invoke<DemoLoginSession>(
    "demo-login",
    { method: "POST" }
  );

  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(
        typeof payload?.error === "string"
          ? payload.error
          : "Demo login is not available right now."
      );
    }
    throw error;
  }

  if (!data?.access_token || !data?.refresh_token) {
    throw new Error("Demo login returned an invalid session.");
  }

  return data;
};
