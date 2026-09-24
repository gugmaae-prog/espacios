# Espacios Platform Audit — 24 September 2026

## Executive summary

This audit reconciles the currently accessible GitHub and Supabase state for Espacios and records the Cloudflare verification limitation encountered during the audit.

### Current status

- GitHub repository: `gugmaae-prog/espacios`
- Repository visibility: **public**
- Default branch: `main`
- Audited main commit: `351b3362fecb2321d484f1ec610915d695c6fe6f`
- Repository files: **43**
- GitHub Actions workflows before this audit: **none**
- Current GitHub source is primarily the Espacios UAE Intelligence Map, not the complete `espacios.me` application.
- Supabase organization: `espacios.me` (Pro)
- Supabase project: `entity` / `ypkfganbwdvcjrcxygta`
- Supabase region: Singapore (`ap-southeast-1`)
- Database: PostgreSQL 17.6
- Public-schema tables: **80**
- Public-schema tables without RLS: **0**
- Important: RLS being enabled does **not** mean the current policies are safe; several unrestricted policies effectively bypass intended row isolation.

## Cloudflare state

The Cloudflare account connector returned `FORBIDDEN` before any account API request could execute during this audit. Therefore no claim in this document should be read as a fresh Cloudflare-account verification.

The repository itself records the following deployment topology:

- map Worker: `psr-portfolio-map-v2`
- routes: `espacios.me/map*` and `psr.espacios.me/map*`
- D1 binding: `DB` → `cba-property-db`
- R2 binding: `MARKET_R2` → `psr-market-intelligence`
- service binding: `PSR_PROPERTY` → `psr-property`
- Workers AI binding: `AI`

The normal `wrangler.jsonc` intentionally uses a non-production candidate Worker name and declares no production routes. Keep that safety property until the Cloudflare account can be re-audited and a reviewed production manifest is introduced.

## Supabase architecture

The single Supabase project currently mixes several workloads:

- Espacios/Aether memory and AI tables
- contacts and Google/Gmail synchronization tables
- email/SMTP tables
- shop/commerce tables
- PSR-specific tables and a PSR Edge Function

This is a **legacy shared-platform boundary**, not the desired long-term tenant model.

### Data volume signal

`public.aether_memories` contains approximately **119,020 rows**, making it the dominant visible table by row count in the current compact inventory.

### Edge Functions

Active functions:

| Function | JWT verification | Audit note |
|---|---:|---|
| `sync-worker` | enabled | uses service role internally |
| `contacts-v2-api` | **disabled** | high risk: uses service role internally and exposes GET/POST without custom authentication |
| `google-sync-v2` | **disabled** | high risk: uses service role internally and exposes POST without custom authentication |
| `smtp-send-v1` | enabled | currently a safe scaffold returning 501 rather than sending |
| `psr-ai-api` | enabled | belongs to PSR; server-to-server design additionally checks `service_role` claim |

The two unauthenticated functions must not be treated as safe simply because they sit behind Supabase. Their source should be hardened before they become canonical public GitHub source.

## Supabase security advisor findings

Current deterministic advisor findings:

- **9** functions with mutable `search_path`
- **1** extension installed in `public` (`vector`)
- **2** `SECURITY DEFINER` functions executable by `anon`
- the same **2** `SECURITY DEFINER` functions executable by authenticated users
- leaked-password protection is disabled
- one RLS-enabled archival/repair table has no policy

The two exposed `SECURITY DEFINER` RPCs are:

- `public.enforce_email_campaign_group_match()`
- `public.rls_auto_enable()`

Both require an explicit privilege review.

## RLS policy risks

Several policies grant unrestricted access with `USING (true)` / `WITH CHECK (true)`. High-priority examples include:

- `aether_memories` — anonymous ALL access
- `ai_journal` — anonymous/authenticated ALL access
- `contacts_v2` — PUBLIC ALL access
- `gmail_accounts_v2` — anonymous/authenticated ALL access
- `gmail_messages_v2` — anonymous/authenticated ALL access
- `google_connections_v2` — anonymous/authenticated ALL access
- `sent_emails` — anonymous/authenticated ALL access
- `smtp_accounts` — anonymous/authenticated SELECT and UPDATE
- `tasks` — anonymous ALL access
- several memory/history tables — anonymous unrestricted SELECT

By contrast, the PSR-specific tables currently use explicit deny-direct-access policies for `anon` and `authenticated`, which is the stronger model.

## Supabase performance advisor findings

- **12** unindexed foreign keys
- **31** RLS policies with per-row auth initialization-plan overhead
- **90** unused indexes (informational; do not remove solely because they are currently unused)
- **100** multiple-permissive-policy findings
- **1** duplicate index on `public.messages`
- Auth connection allocation is configured as an absolute maximum of 10 instead of percentage-based

## Recent operational signals

Within the inspected log window:

- `GET /rest/v1/aether_action_checkpoints` — 1,020 successful requests
- `GET /rest/v1/messages` — 540 successful requests
- `GET /rest/v1/gmail_messages_v2` — 480 successful requests
- `GET /rest/v1/aether_unified_events` — 480 successful requests
- `GET /rest/v1/whatsapp_messages` — **480 × 404**

The repeated `whatsapp_messages` 404 indicates application/schema drift and should be traced to its caller before adding or recreating any table.

Postgres logs in the sampled period showed routine checkpoints and one client connection reset, not a database outage pattern.

## Required remediation order

1. **Contain access-control risk first**
   - review/remove unrestricted anonymous/public policies, especially Gmail, contacts, SMTP, journal, task, memory, and message surfaces
   - preserve intentional public-read policies only where the data is genuinely public
2. **Harden Edge Functions**
   - add verified JWT/custom authentication to `contacts-v2-api` and `google-sync-v2` before treating them as production APIs
3. **Revoke exposed SECURITY DEFINER RPC execution**
   - confirm intended caller, then restrict execute privileges or convert to invoker semantics where possible
4. **Enable leaked-password protection**
5. **Resolve function search paths**
6. **Trace the `whatsapp_messages` 404 caller**
7. **Optimize RLS and foreign-key indexes**
8. **Plan tenant separation**
   - Espacios/Aether remains in Espacios infrastructure
   - PSR data/API moves under PSR ownership
   - Haus & Grace remains independent and D1-backed unless intentionally redesigned
9. **Re-audit Cloudflare**
   - inventory Workers, routes, bindings, D1, R2, Durable Objects, cron triggers, build connections, DNS, and secrets-by-name
10. **Only then enable GitHub → Cloudflare automatic production deployment**

## Source-of-truth policy

The target operating model is:

```text
GitHub reviewed source
        ↓
CI / release gate
        ↓
Cloudflare / Supabase deployment
        ↓
production
```

Runtime configuration and secret values stay in the platform secret stores. GitHub holds code, migration source, schemas, non-secret binding declarations, and deployment documentation.
