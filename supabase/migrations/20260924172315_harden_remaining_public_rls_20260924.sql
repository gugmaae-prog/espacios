-- Preserve intentional public reads while removing public writes.
drop policy if exists "public_all_patches" on public.aether_patches;
create policy "public_read_patches"
on public.aether_patches
for select
to anon, authenticated
using (true);

drop policy if exists "anon_all_capabilities" on public.capabilities;
create policy "public_read_capabilities"
on public.capabilities
for select
to anon, authenticated
using (true);

-- Server-only operational data.
drop policy if exists "service_all_emails" on public.emails;
revoke all on table public.emails from anon, authenticated;
grant all on table public.emails to service_role;

drop policy if exists "anon_all_journal_logs" on public.journal_logs;
revoke all on table public.journal_logs from anon, authenticated;
grant all on table public.journal_logs to service_role;

drop policy if exists "service_role_all" on public.oauth_tokens;
revoke all on table public.oauth_tokens from anon, authenticated;
grant all on table public.oauth_tokens to service_role;
