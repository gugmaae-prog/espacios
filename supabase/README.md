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

## Critical rule

These files are a source mirror, **not an instruction to redeploy automatically**. Two functions (`contacts-v2-api`, `google-sync-v2`) currently have `verify_jwt=false` and use the Supabase service-role key internally. They must be hardened before GitHub-driven deployment is enabled.

## Secrets

Never commit:

- `SUPABASE_SERVICE_ROLE_KEY` / secret key
- database passwords
- OAuth refresh/access tokens
- SMTP credentials
- private customer/contact/message datasets

Only source code and non-secret project metadata belong in Git.
