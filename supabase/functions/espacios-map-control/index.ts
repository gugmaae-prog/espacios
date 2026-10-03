import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "access-control-allow-origin": "https://espacios.me",
  "access-control-allow-methods": "GET,HEAD,OPTIONS",
  "access-control-allow-headers": "content-type",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "x-robots-tag": "noindex, nofollow"
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("Method not allowed", { status: 405, headers: { ...cors, allow: "GET, HEAD" } });
  }
  const base = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!base || !service) {
    return new Response(JSON.stringify({
      connected:false,
      error:"Supabase function runtime bindings unavailable",
      runtime:{hasUrl:!!base,hasServiceRole:!!service}
    }), {status:503,headers:{...cors,"content-type":"application/json; charset=utf-8"}});
  }
  try {
    const client = createClient(base, service, {
      auth: { persistSession:false, autoRefreshToken:false }
    });
    const [configResult, releaseResult] = await Promise.all([
      client.from("espacios_map_runtime_config").select("*").eq("id","production").maybeSingle(),
      client.from("espacios_map_release_registry").select("*").eq("environment","production").order("created_at",{ascending:false}).limit(1).maybeSingle()
    ]);
    if (configResult.error || releaseResult.error) {
      return new Response(JSON.stringify({
        connected:false,
        error:"Control registry unavailable",
        database:{
          config:configResult.error ? {code:configResult.error.code,message:configResult.error.message} : null,
          release:releaseResult.error ? {code:releaseResult.error.code,message:releaseResult.error.message} : null
        }
      }), {status:503,headers:{...cors,"content-type":"application/json; charset=utf-8"}});
    }
    const payload = {
      connected:true,
      release:"20261003-supabase-control-v1",
      projectRef:"ypkfganbwdvcjrcxygta",
      config:configResult.data,
      latestRelease:releaseResult.data,
      authority:{
        runtime:"Cloudflare Workers",
        source:"GitHub gugmaae-prog/espacios",
        controlAudit:"Supabase",
        marketEvidence:"Cloudflare D1/R2 + PSR_PROPERTY"
      }
    };
    return new Response(req.method==="HEAD"?null:JSON.stringify(payload,null,2),{
      status:200,
      headers:{...cors,"content-type":"application/json; charset=utf-8"}
    });
  } catch (error) {
    return new Response(JSON.stringify({
      connected:false,
      error:"Control endpoint failure",
      detail:String(error instanceof Error ? error.message : error)
    }), {status:503,headers:{...cors,"content-type":"application/json; charset=utf-8"}});
  }
});