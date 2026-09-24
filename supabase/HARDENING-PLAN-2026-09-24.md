# Supabase Hardening Plan — 24 September 2026

> **Live status update:** P0 access-control hardening was applied to production on 24 September 2026. Broad anonymous/public policies on sensitive tables were removed, sensitive service-only tables were revoked from `anon`/`authenticated`, the two SECURITY DEFINER RPCs were restricted to `service_role`, mutable function search paths were pinned, the duplicate `messages` index was removed, and `contacts-v2-api` / `google-sync-v2` were redeployed as JWT-verified service-role-only v3 functions.
>
> After the change, Supabase Security Advisor was reduced to three residual findings: `vector` installed in `public`, leaked-password protection disabled, and one repair table with RLS/no policy. The repair-table finding was then resolved with migration `20260924171459_lock_repair_table_20260924`.

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

## Storage audit

Current Storage buckets:

- `aether-media` — **public**, 98 objects, ~13.3 MB
- `the-void` — **public**, 1 object

Public buckets are not automatically a defect, but they must contain only intentionally public assets. Do not place private memory, CRM exports, documents, inbox content, or user-uploaded confidential files in these buckets.

## Capacity / relation-size signals

Largest observed relations by total relation size:

- `public.messages` — ~39.8 MB
- `public.aether_memories` — ~32.9 MB; ~119,020 live rows
- `public.agent_memories` — ~21.6 MB
- `public.ai_journal` — ~15.1 MB
- `public.embeddings` — ~5.7 MB
- `public.gmail_messages_v2` — ~2.2 MB

Large physical size with zero estimated live rows on some relations suggests historical churn/dead tuples or stale statistics may exist. Review vacuum/analyze behavior before making assumptions from row estimates alone.

## Scheduled database jobs

`pg_cron` is installed, but `cron.job` currently contains **no scheduled jobs**.

## Auth footprint

Current Auth user count: **6**.

- 6 email-confirmed
- 6 have signed in at least once
- 0 anonymous users

Leaked-password protection is still disabled per Security Advisor and should be enabled.
