# Supabase Hardening Plan — 24 September 2026

> **Live status update:** P0 access-control hardening was applied to production on 24 September 2026. Broad anonymous/public policies on sensitive tables were removed, sensitive service-only tables were revoked from `anon`/`authenticated`, the two SECURITY DEFINER RPCs were restricted to `service_role`, mutable function search paths were pinned, the duplicate `messages` index was removed, and `contacts-v2-api` / `google-sync-v2` were redeployed as JWT-verified service-role-only v3 functions.
>
> After the change, Supabase Security Advisor was reduced to three residual findings. The repair-table finding was resolved with migration `20260924171459_lock_repair_table_20260924`, and the relocatable `vector` extension was moved from `public` to `extensions`. The database Security Advisor now reports only one remaining Auth-service warning: leaked-password protection is disabled.

## Completed remediation

### Access control — resolved

Production migrations removed the unrestricted anonymous/public policies on sensitive Aether, Gmail, contact, message, SMTP, task and operational tables. Server-only surfaces now rely on explicit `service_role` access, while genuine user-owned policies remain scoped by `auth.uid()`.

### Edge Functions — resolved

- `contacts-v2-api` → version 3, JWT verification enabled, explicit service-role authorization
- `google-sync-v2` → version 3, JWT verification enabled, explicit service-role authorization

Neither function showed recent invocation traffic before the hardening deploy.

### SECURITY DEFINER — resolved

Execute access for `public.enforce_email_campaign_group_match()` and `public.rls_auto_enable()` was revoked from `public`, `anon` and `authenticated`, and retained for `service_role`.

### Function search paths — resolved

All functions previously reported by Security Advisor for mutable `search_path` were pinned to a controlled search path.

### Extension placement — resolved

`vector` 0.8.0 was relocatable in this project and was moved from `public` to `extensions`.

### RLS performance — resolved

The 31 per-row auth initialization-plan warnings were removed by using stable `(select auth.uid())` / `(select auth.role())` expressions and consolidating redundant policies.

### Foreign-key indexes — resolved

All 12 foreign keys reported without covering indexes received explicit indexes.

### Multiple permissive policies — resolved

Redundant SELECT/ALL combinations were consolidated; Performance Advisor no longer reports the previous multiple-permissive-policy warnings.

### Duplicate index — resolved

The duplicate `idx_messages_session` index was removed; `messages_session_created_idx` remains.

### WhatsApp compatibility drift — resolved

The legacy Cloudflare caller was identified as a service-role poll every three minutes. Existing WhatsApp data already lived in `public.messages` as `whatsapp_inbound` / `whatsapp_outbound` rows.

Migration `20260924174042_restore_whatsapp_messages_compat_view_20260924` restored `public.whatsapp_messages` as a read-only, security-invoker compatibility view rather than duplicating data. Subsequent live requests changed from HTTP 404 to HTTP 200 with 500-row pages.

## Remaining platform settings

### Auth

- **Leaked-password protection:** still disabled. This is the only remaining Supabase Security Advisor warning and must be enabled through the Supabase Auth configuration surface; it is not a database migration.
- **Auth database connection allocation:** Performance Advisor reports the current absolute limit of 10 as informational. Consider percentage-based allocation before scaling compute.

### Index usage

Performance Advisor currently reports unused indexes as informational. Newly created foreign-key indexes will naturally appear unused until relevant workload exercises them. Do **not** mass-delete unused indexes without workload/query-plan evidence.

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
