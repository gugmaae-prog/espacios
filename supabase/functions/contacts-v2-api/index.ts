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
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ ok:false, error:"server_not_configured" },500);
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth:{ persistSession:false, autoRefreshToken:false } });
  const url = new URL(req.url);
  try {
    if (req.method === "GET") {
      const email = url.searchParams.get("email");
      if (email) {
        const { data, error } = await supabase.from("contacts_v2")
          .select("*, contact_emails_v2(*), contact_phones_v2(*), contact_orgs_v2(*), contact_memory_v2(*)")
          .eq("normalized_primary_email", email.toLowerCase()).limit(1).maybeSingle();
        if (error) return json({ ok:false, error:error.message },500);
        return json({ ok:true, data });
      }
      const { data, error } = await supabase.from("contacts_v2")
        .select("id,primary_email,full_name,display_name,company,job_title,source,status,created_at,updated_at")
        .order("updated_at",{ascending:false}).limit(100);
      if (error) return json({ ok:false, error:error.message },500);
      return json({ ok:true, data });
    }
    const body = await req.json();
    const mode = body.mode || "upsert_contact";
    if (mode === "upsert_contact") {
      const { user_id=null, email, full_name=null, source="manual", metadata={} } = body;
      if (!email) return json({ ok:false, error:"email is required" },400);
      const { data, error } = await supabase.rpc("upsert_contact_v2", {
        p_user_id:user_id, p_primary_email:email, p_full_name:full_name, p_source:source, p_metadata:metadata
      });
      if (error) return json({ ok:false, error:error.message },500);
      return json({ ok:true, contact_id:data });
    }
    if (mode === "add_memory") {
      const { user_id=null, contact_id, content, memory_type="note", source="manual", importance=3, metadata={} } = body;
      if (!contact_id || !content) return json({ ok:false, error:"contact_id and content are required" },400);
      const { data, error } = await supabase.from("contact_memory_v2")
        .insert({ user_id, contact_id, content, memory_type, source, importance, metadata }).select().single();
      if (error) return json({ ok:false, error:error.message },500);
      return json({ ok:true, data });
    }
    if (mode === "add_event") {
      const { user_id=null, contact_id, event_type, title=null, body:eventBody=null, source="system", external_id=null, metadata={} } = body;
      if (!contact_id || !event_type) return json({ ok:false, error:"contact_id and event_type are required" },400);
      const { data, error } = await supabase.from("contact_events_v2")
        .insert({ user_id, contact_id, event_type, title, body:eventBody, source, external_id, metadata }).select().single();
      if (error) return json({ ok:false, error:error.message },500);
      return json({ ok:true, data });
    }
    return json({ ok:false, error:"unsupported_mode" },400);
  } catch (e) { return json({ ok:false, error:e instanceof Error?e.message:String(e) },500); }
});