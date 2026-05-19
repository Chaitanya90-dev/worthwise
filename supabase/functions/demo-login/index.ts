import "jsr:@supabase/functions-js/edge-runtime.d.ts";
declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const DEMO_EMAIL = Deno.env.get("DEMO_EMAIL");
const DEMO_PASSWORD = Deno.env.get("DEMO_PASSWORD");

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json(405, { error: "Method not allowed." });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_EMAIL || !DEMO_PASSWORD) {
    return json(503, { error: "Demo login is not available right now." });
  }

  try {
    const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      }),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        typeof payload?.msg === "string"
          ? payload.msg
          : typeof payload?.error_description === "string"
            ? payload.error_description
            : typeof payload?.error === "string"
              ? payload.error
              : "Demo login failed.";
      return json(response.status, { error: message });
    }

    if (
      typeof payload?.access_token !== "string" ||
      typeof payload?.refresh_token !== "string"
    ) {
      return json(502, { error: "Demo login returned an invalid session." });
    }

    return json(200, {
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      expires_at: payload.expires_at ?? null,
      expires_in: payload.expires_in ?? null,
      token_type: payload.token_type ?? null,
      user: payload.user ?? null,
    });
  } catch (error) {
    console.error("Demo login failed", error);
    return json(500, { error: "Demo login failed." });
  }
});
