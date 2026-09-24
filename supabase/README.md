# Supabase Source Authority

Audit/sync date: **24 September 2026**

## Project

- Organization: `espacios.me`
- Project: `entity`
- Project ref: `ypkfganbwdvcjrcxygta`
- Region: `ap-southeast-1`
- PostgreSQL: 17.6

This is a legacy shared Supabase project. It currently contains Espacios/Aether workloads plus some PSR-owned tables/functions. The target architecture is tenant-separated even if the physical database has not yet been split.

## Function ownership

Mirrored here because they belong to the Espacios/Aether platform:

- `sync-worker`
- `contacts-v2-api`
- `google-sync-v2`
- `smtp-send-v1`

Not stored here:

- `psr-ai-api` → owned by `gugmaae-prog/psr-homes` and mirrored there

## Current runtime security state

The Git mirror matches the live hardened functions:

- `contacts-v2-api` — version 3, `verify_jwt=true`, service-role authorization required
- `google-sync-v2` — version 3, `verify_jwt=true`, service-role authorization required
- `sync-worker` — JWT verification enabled
- `smtp-send-v1` — JWT verification enabled
- `psr-ai-api` — PSR-owned and mirrored in `gugmaae-prog/psr-homes`

Database Security Advisor now reports only one remaining Auth-service setting: leaked-password protection is disabled. Database-level access-control warnings have been resolved.

These files remain source authority rather than an instruction to enable automatic production deployment without review.

## Secrets

Never commit:

- `SUPABASE_SERVICE_ROLE_KEY` / secret key
- database passwords
- OAuth refresh/access tokens
- SMTP credentials
- private customer/contact/message datasets

Only source code and non-secret project metadata belong in Git.
