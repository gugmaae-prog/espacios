# Supabase Hardening Plan — 24 September 2026

## P0 — access control

Review and replace unrestricted `anon` / `public` policies before doing performance cleanup.

High-priority unrestricted surfaces found in the live project include:

- `aether_memories`
- `ai_journal`
- `contacts_v2`
- `gmail_accounts_v2`
- `gmail_messages_v2`
- `google_connections_v2`
- `sent_emails`
- `smtp_accounts`
- `tasks`
- selected memory/history/message tables

Do not drop these policies blindly. First identify actual callers and whether they authenticate through Supabase directly, Cloudflare, or another backend.

## P0 — Edge Functions

`contacts-v2-api` and `google-sync-v2` currently run with `verify_jwt=false`, wildcard CORS, and instantiate a service-role Supabase client. Harden by adding one of:

1. Supabase JWT verification plus authorization checks; or
2. a server-to-server signed secret/header check with origin-independent validation; or
3. move the functionality behind a private Cloudflare service boundary.

Until hardened, do not enable automatic redeployment from Git.

## P0 — SECURITY DEFINER

Review execution grants for:

- `public.enforce_email_campaign_group_match()`
- `public.rls_auto_enable()`

Both were flagged as executable by `anon` and `authenticated` while running as SECURITY DEFINER.

## P1 — Auth

- enable leaked-password protection
- review Auth database connection allocation (absolute 10 → percentage-based if appropriate)

## P1 — function safety

Nine functions were flagged for mutable `search_path`. Pin a safe schema search path on application functions.

## P1 — RLS performance

31 policies repeatedly evaluate auth functions per row. Prefer `(select auth.uid())` and equivalent stable expressions where applicable.

## P1 — indexing

Review 12 unindexed foreign keys and add indexes where the relationship participates in deletes, joins, filters, or ownership checks.

## P2 — index hygiene

`public.messages` has duplicate indexes: `idx_messages_session` and `messages_session_created_idx`. Verify definitions and drop one in a controlled migration.

Do not remove the ~90 currently-unused indexes solely because the advisor reports them unused; use workload evidence first.

## P2 — application drift

Recent traffic shows repeated requests to `/rest/v1/whatsapp_messages` returning 404. Trace the caller and either remove the stale request or restore the intended API through a reviewed migration.

## Tenant separation

Long-term:

- Espacios/Aether stays under Espacios governance
- PSR tables/functions move under PSR governance/project when feasible
- Haus & Grace remains independently governed (currently Cloudflare D1-based)
