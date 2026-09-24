# Supabase Auth hardening runbook

Project: `entity` (`ypkfganbwdvcjrcxygta`)

Database/Edge Function hardening is complete. Two account-level Auth settings remain:

- `password_hibp_enabled = true`
- `db_max_pool_size = 17`
- `db_max_pool_size_unit = percent`

The current database has `max_connections = 60`. A 17% Auth allocation corresponds to
approximately 10.2 connections, preserving the previous 10-connection ceiling while
allowing Auth capacity to scale with future compute.

## Run

1. Add a GitHub Actions secret named `SUPABASE_ACCESS_TOKEN` with Management API
   permissions `auth_config_write` and `project_admin_write`.
2. Open Actions → **Apply Supabase Auth Hardening**.
3. Run workflow and type `HARDEN-AUTH`.
4. Rerun the Supabase Security and Performance Advisors.

The workflow logs only the three non-secret Auth settings above.
