-- Applied to production on 2026-09-24.
-- Removes unrestricted anonymous/public access, restricts SECURITY DEFINER RPCs,
-- pins function search paths, and removes a confirmed duplicate index.

drop policy if exists "anon_all_aether_memories" on public.aether_memories;
drop policy if exists "anon_can_insert_aether_memories" on public.aether_memories;
drop policy if exists "service_all_aether_memories" on public.aether_memories;
revoke all on table public.aether_memories from anon, authenticated;
grant select, insert, update, delete on table public.aether_memories to service_role;

drop policy if exists "anon_read_agent_memories" on public.agent_memories;
drop policy if exists "service_all_agent_memories" on public.agent_memories;
revoke all on table public.agent_memories from anon, authenticated;
grant select, insert, update, delete on table public.agent_memories to service_role;

drop policy if exists "anon_all_ai_journal" on public.ai_journal;
drop policy if exists "anon_read_ai_habits" on public.ai_habits;
drop policy if exists "anon_read_ai_interests" on public.ai_interests;
drop policy if exists "anon_read_ai_patterns" on public.ai_patterns;
drop policy if exists "anon_read_ai_user_prefs" on public.ai_user_prefs;
drop policy if exists "public_all_contacts_v2" on public.contacts_v2;
drop policy if exists "anon_all_gmail_accounts" on public.gmail_accounts_v2;
drop policy if exists "anon_all_gmail_messages" on public.gmail_messages_v2;
drop policy if exists "anon_all_google_connections" on public.google_connections_v2;

drop policy if exists "anon_read_chat_history" on public.chat_history;
revoke all on table public.chat_history from anon, authenticated;
grant select, insert, update, delete on table public.chat_history to service_role;

drop policy if exists "anon_read_embeddings" on public.embeddings;
revoke all on table public.embeddings from anon, authenticated;
grant select, insert, update, delete on table public.embeddings to service_role;

drop policy if exists "anon_read_facts" on public.facts;
revoke all on table public.facts from anon, authenticated;
grant select, insert, update, delete on table public.facts to service_role;

drop policy if exists "anon_read_memories" on public.memories;
revoke all on table public.memories from anon, authenticated;
grant select, insert, update, delete on table public.memories to service_role;

drop policy if exists "anon_read_messages" on public.messages;
drop policy if exists "service_all_messages" on public.messages;
revoke all on table public.messages from anon, authenticated;
grant select, insert, update, delete on table public.messages to service_role;

drop policy if exists "service_all_learning_events" on public.learning_events;
revoke all on table public.learning_events from anon, authenticated;
grant select, insert, update, delete on table public.learning_events to service_role;

drop policy if exists "service_all_observations" on public.observations;
revoke all on table public.observations from anon, authenticated;
grant select, insert, update, delete on table public.observations to service_role;

drop policy if exists "service_all_plans" on public.plans;
revoke all on table public.plans from anon, authenticated;
grant select, insert, update, delete on table public.plans to service_role;

drop policy if exists "anon_all_sent_emails" on public.sent_emails;
revoke all on table public.sent_emails from anon, authenticated;
grant select, insert, update, delete on table public.sent_emails to service_role;

drop policy if exists "public_read_smtp" on public.smtp_accounts;
drop policy if exists "public_write_smtp" on public.smtp_accounts;
revoke all on table public.smtp_accounts from anon, authenticated;
grant select, insert, update, delete on table public.smtp_accounts to service_role;

drop policy if exists "anon_all_tasks" on public.tasks;
revoke all on table public.tasks from anon, authenticated;
grant select, insert, update, delete on table public.tasks to service_role;

revoke execute on function public.enforce_email_campaign_group_match() from public, anon, authenticated;
grant execute on function public.enforce_email_campaign_group_match() to service_role;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
grant execute on function public.rls_auto_enable() to service_role;

alter function public.set_updated_at_agent_memories() set search_path = public, extensions, pg_temp;
alter function public.search_memories_filtered(vector, integer, text, text) set search_path = public, extensions, pg_temp;
alter function public.search_memories(vector, integer) set search_path = public, extensions, pg_temp;
alter function public.match_embeddings(vector, integer, double precision) set search_path = public, extensions, pg_temp;
alter function public.set_updated_at_v2() set search_path = public, extensions, pg_temp;
alter function public.find_contact_by_email_v2(uuid, text) set search_path = public, extensions, pg_temp;
alter function public.upsert_contact_v2(uuid, text, text, text, jsonb) set search_path = public, extensions, pg_temp;
alter function public.enforce_email_campaign_group_match() set search_path = public, extensions, pg_temp;
alter function public.touch_updated_at() set search_path = public, extensions, pg_temp;
alter function public.rls_auto_enable() set search_path = public, extensions, pg_temp;

drop index if exists public.idx_messages_session;
