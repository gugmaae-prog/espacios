-- Applied to production on 2026-09-24.
-- pgvector 0.8.0 is relocatable in this project, so move the extension out of public.
alter extension vector set schema extensions;
