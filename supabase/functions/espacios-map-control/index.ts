import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
  try {
    const base = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const headers = { apikey: anon, accept: "application/json" };
    const [configRes, releaseRes] = await Promise.all([
      fetch(base + "/rest/v1/espacios_map_runtime_config?id=eq.production&select=*", { headers }),
      fetch(base + "/rest/v1/espacios_map_release_registry?environment=eq.production&select=*&order=created_at.desc&limit=1", { headers })
    ]);
    if (!configRes.ok || !releaseRes.ok) {
      return new Response(JSON.stringify({
        connected: false,
        error: "Control registry unavailable",
        status: { config: configRes.status, release: releaseRes.status }
      }), { status: 503, headers: { ...cors, "content-type": "application/json; charset=utf-8" } });
    }
    const config = (await configRes.json())[0] ?? null;
    const latestRelease = (await releaseRes.json())[0] ?? null;
    const payload = {
      connected: true,
      release: "20261003-supabase-control-v1",
      projectRef: "ypkfganbwdvcjrcxygta",
      config,
      latestRelease,
      authority: {
        runtime: "Cloudflare Workers",
        source: "GitHub gugmaae-prog/espacios",
        controlAudit: "Supabase",
        marketEvidence: "Cloudflare D1/R2 + PSR_PROPERTY"
      }
    };
    return new Response(req.method === "HEAD" ? null : JSON.stringify(payload, null, 2), {
      status: 200,
      headers: { ...cors, "content-type": "application/json; charset=utf-8" }
    });
  } catch {
    return new Response(JSON.stringify({ connected:false, error:"Control endpoint failure" }), {
      status:503,
      headers:{...cors,"content-type":"application/json; charset=utf-8"}
    });
  }
});