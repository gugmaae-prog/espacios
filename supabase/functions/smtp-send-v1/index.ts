import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-aether-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ ok: false, error: "POST required" }, 405);

  const body = await req.json().catch(() => null);
  if (!body) return json({ ok: false, error: "Invalid JSON" }, 400);

  const smtpAccount = body.smtp_account || null;
  const to = Array.isArray(body.to) ? body.to : [body.to].filter(Boolean);
  const subject = String(body.subject || "");
  const bodyText = String(body.body_text || body.text || body.body || "");

  if (!smtpAccount) return json({ ok: false, error: "smtp_account required" }, 400);
  if (!to.length) return json({ ok: false, error: "to required" }, 400);
  if (!subject && !bodyText) return json({ ok: false, error: "subject or body required" }, 400);

  // Safety scaffold: the function is deployed and callable, but actual SMTP transport
  // should be enabled only after validating the selected SMTP library/provider in Supabase runtime.
  // This prevents breaking the existing Gmail path while giving Cloudflare a stable additive endpoint.
  return json({
    ok: false,
    provider: "smtp",
    mode: "scaffold",
    error: "SMTP transport not enabled yet. Function is deployed for wiring/test only.",
    from_email: smtpAccount.email || null,
    to,
    subject
  }, 501);
});
