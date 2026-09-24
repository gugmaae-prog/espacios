import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (req.method === "POST") {
      const body = await req.json();
      const { user_id = null, email } = body;

      if (!email) return json({ ok: false, error: "email required" }, 400);

      // MOCK SYNC (safe test version)
      const { data: contactId } = await supabase.rpc("upsert_contact_v2", {
        p_user_id: user_id,
        p_primary_email: email,
        p_full_name: "Google Synced User",
        p_source: "google",
        p_metadata: { synced: true }
      });

      await supabase.from("contact_events_v2").insert({
        user_id,
        contact_id: contactId,
        event_type: "sync",
        title: "Google Sync",
        metadata: { test: true }
      });

      return json({ ok: true, contact_id: contactId, message: "mock sync complete" });
    }

    return json({ ok: true, status: "ready" });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});