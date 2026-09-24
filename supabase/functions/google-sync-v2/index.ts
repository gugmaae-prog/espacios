import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS }); }
function serviceRoleRequest(req: Request) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return false;
  const parts = auth.slice(7).trim().split(".");
  if (parts.length !== 3) return false;
  try {
    let payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (payload.length % 4) payload += "=";
    return JSON.parse(atob(payload)).role === "service_role";
  } catch { return false; }
}
Deno.serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "POST") return json({ ok:false, error:"method_not_allowed" },405);
  if (!serviceRoleRequest(req)) return json({ ok:false, error:"server_authorization_required" },403);
  if (req.method === "GET") return json({ ok:true, status:"ready" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok:false, error:"server_not_configured" },500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth:{ persistSession:false, autoRefreshToken:false } });

  try {
    const body = await req.json();
    const { user_id=null, email } = body;
    if (!email) return json({ ok:false, error:"email_required" },400);

    const { data:contactId, error:upsertError } = await supabase.rpc("upsert_contact_v2", {
      p_user_id:user_id,
      p_primary_email:email,
      p_full_name:"Google Synced User",
      p_source:"google",
      p_metadata:{ synced:true },
    });
    if (upsertError) return json({ ok:false, error:upsertError.message },500);

    const { error:eventError } = await supabase.from("contact_events_v2").insert({
      user_id,
      contact_id:contactId,
      event_type:"sync",
      title:"Google Sync",
      metadata:{ test:true },
    });
    if (eventError) return json({ ok:false, error:eventError.message },500);

    return json({ ok:true, contact_id:contactId, message:"mock sync complete" });
  } catch (e) {
    return json({ ok:false, error:e instanceof Error?e.message:String(e) },500);
  }
});