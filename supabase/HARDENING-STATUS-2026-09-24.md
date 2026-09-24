# Supabase hardening status — 24 September 2026

Live project: `entity` (`ypkfganbwdvcjrcxygta`)

## Applied and mirrored

- `20260924171246_harden_shared_platform_access_20260924.sql`
- `20260924171459_lock_repair_table_20260924.sql`
- `20260924171939_move_vector_to_extensions_20260924.sql`
- `20260924172315_harden_remaining_public_rls_20260924.sql`
- `20260924172600_optimize_rls_and_fk_indexes_20260924.sql`

## Live Edge Function hardening

- `contacts-v2-api` → version 4, `verify_jwt=true`, explicit `service_role` check.
- `google-sync-v2` → version 4, `verify_jwt=true`, explicit `service_role` check.

## Current advisor state

Security Advisor now reports only:

- leaked-password protection disabled

Performance Advisor now reports only:

- unused indexes (informational; do not mass-delete)
- Auth DB connection allocation is absolute rather than percentage-based

The remaining two actionable settings are Supabase Auth-service configuration, not database DDL, and are not writable through the connected Supabase tool surface.
