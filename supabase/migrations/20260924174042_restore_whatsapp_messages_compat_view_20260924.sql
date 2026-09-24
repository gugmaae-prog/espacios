-- Applied to production on 2026-09-24.
-- Restore the legacy read endpoint without duplicating WhatsApp data.
create or replace view public.whatsapp_messages
with (security_invoker = true)
as
select
  id,
  session_id,
  role,
  content,
  provider,
  metadata,
  created_at
from public.messages
where role in ('whatsapp_inbound', 'whatsapp_outbound');

revoke all on table public.whatsapp_messages from public, anon, authenticated;
grant select on table public.whatsapp_messages to service_role;

comment on view public.whatsapp_messages is
  'Read-only compatibility view over public.messages for legacy Cloudflare polling; WhatsApp rows are identified by role.';
