-- Applied to production on 2026-09-24.
revoke all on table public.aether_reminder_repair_20260908 from anon, authenticated;
grant select, insert, update, delete on table public.aether_reminder_repair_20260908 to service_role;

drop policy if exists "service_role_only_aether_reminder_repair_20260908"
  on public.aether_reminder_repair_20260908;

create policy "service_role_only_aether_reminder_repair_20260908"
  on public.aether_reminder_repair_20260908
  for all
  to service_role
  using (true)
  with check (true);
