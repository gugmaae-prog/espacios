-- Applied to production on 2026-09-24.
-- Cover foreign keys flagged by Performance Advisor.
create index if not exists ai_habit_logs_user_id_idx on public.ai_habit_logs(user_id);
create index if not exists card_comments_card_id_idx on public.card_comments(card_id);
create index if not exists card_subtasks_card_id_idx on public.card_subtasks(card_id);
create index if not exists contact_events_v2_user_id_idx on public.contact_events_v2(user_id);
create index if not exists contact_orgs_v2_contact_id_idx on public.contact_orgs_v2(contact_id);
create index if not exists email_campaigns_sender_id_idx on public.email_campaigns(sender_id);
create index if not exists gmail_accounts_v2_connection_id_idx on public.gmail_accounts_v2(connection_id);
create index if not exists gmail_messages_v2_gmail_thread_id_idx on public.gmail_messages_v2(gmail_thread_id);
create index if not exists gmail_messages_v2_user_id_idx on public.gmail_messages_v2(user_id);
create index if not exists gmail_threads_v2_user_id_idx on public.gmail_threads_v2(user_id);
create index if not exists google_files_v2_connection_id_idx on public.google_files_v2(connection_id);
create index if not exists sync_jobs_v2_user_id_idx on public.sync_jobs_v2(user_id);

-- Avoid per-row auth function evaluation.
alter policy "service role manages aether files" on public.aether_files
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);

alter policy "Users manage own content_prefs" on public.ai_content_prefs
  using ((select auth.uid()) = user_id);

alter policy "Users insert own conversations" on public.ai_conversations
  with check ((select auth.uid()) = user_id);
alter policy "Users read own conversations" on public.ai_conversations
  using ((select auth.uid()) = user_id);
drop policy if exists "Users read own fallback log" on public.ai_conversations;

alter policy "Users insert own fallback log" on public.ai_fallback_log
  with check ((select auth.uid()) = user_id);

alter policy "Users manage own habit_logs" on public.ai_habit_logs
  using ((select auth.uid()) = user_id);
alter policy "Users manage own habits" on public.ai_habits
  using ((select auth.uid()) = user_id);
alter policy "Users manage own interests" on public.ai_interests
  using ((select auth.uid()) = user_id);
alter policy "Users manage own journal" on public.ai_journal
  using ((select auth.uid()) = user_id);
alter policy "Users manage own prefs" on public.ai_user_prefs
  using ((select auth.uid()) = user_id);

-- Merge overlapping read policies for patterns.
drop policy if exists "Anyone can read system patterns" on public.ai_patterns;
drop policy if exists "Users read own patterns" on public.ai_patterns;
create policy "Users read accessible patterns"
  on public.ai_patterns
  for select
  to public
  using (user_id is null or (select auth.uid()) = user_id);
alter policy "Users insert own patterns" on public.ai_patterns
  with check ((select auth.uid()) = user_id);
alter policy "Users update own patterns" on public.ai_patterns
  using ((select auth.uid()) = user_id);

-- The ALL modify policies already cover SELECT with the same ownership predicate;
-- remove duplicate SELECT policies and optimize the remaining predicates.
drop policy if exists "contact_events_v2_select_own" on public.contact_events_v2;
alter policy "contact_events_v2_modify_own" on public.contact_events_v2
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "contact_memory_v2_select_own" on public.contact_memory_v2;
alter policy "contact_memory_v2_modify_own" on public.contact_memory_v2
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "contacts_v2_select_own" on public.contacts_v2;
alter policy "contacts_v2_modify_own" on public.contacts_v2
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "gmail_accounts_v2_select_own" on public.gmail_accounts_v2;
alter policy "gmail_accounts_v2_modify_own" on public.gmail_accounts_v2
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "gmail_messages_v2_select_own" on public.gmail_messages_v2;
alter policy "gmail_messages_v2_modify_own" on public.gmail_messages_v2
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "gmail_threads_v2_select_own" on public.gmail_threads_v2;
alter policy "gmail_threads_v2_modify_own" on public.gmail_threads_v2
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "google_connections_v2_select_own" on public.google_connections_v2;
alter policy "google_connections_v2_modify_own" on public.google_connections_v2
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "sync_jobs_v2_select_own" on public.sync_jobs_v2;
alter policy "sync_jobs_v2_modify_own" on public.sync_jobs_v2
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "service_role_full_access" on public.worker_heartbeats
  using ((select auth.role()) = 'service_role'::text)
  with check ((select auth.role()) = 'service_role'::text);
