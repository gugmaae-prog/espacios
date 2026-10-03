create table if not exists public.espacios_map_runtime_config (
  id text primary key,
  enabled boolean not null default true,
  data_room_public boolean not null default false,
  release_channel text not null default 'production',
  expected_frontend_release text,
  expected_worker_version text,
  source_repo text not null default 'gugmaae-prog/espacios',
  source_branch text not null default 'main',
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.espacios_map_release_registry (
  id uuid primary key default gen_random_uuid(),
  environment text not null default 'production',
  release_tag text not null,
  frontend_release text,
  github_sha text,
  github_pr integer,
  cloudflare_worker text not null default 'psr-portfolio-map-v2',
  cloudflare_worker_version text,
  cloudflare_deployment_id text,
  data_room_public boolean not null default false,
  source_sync_state text not null default 'unknown',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists espacios_map_release_registry_created_idx
  on public.espacios_map_release_registry (environment, created_at desc);

alter table public.espacios_map_runtime_config enable row level security;
alter table public.espacios_map_release_registry enable row level security;

revoke all on table public.espacios_map_runtime_config from anon, authenticated;
revoke all on table public.espacios_map_release_registry from anon, authenticated;
grant select on table public.espacios_map_runtime_config to anon, authenticated;
grant select on table public.espacios_map_release_registry to anon, authenticated;
grant select, insert, update, delete on table public.espacios_map_runtime_config to service_role;
grant select, insert, update, delete on table public.espacios_map_release_registry to service_role;

drop policy if exists "public read map runtime config" on public.espacios_map_runtime_config;
create policy "public read map runtime config"
on public.espacios_map_runtime_config
for select
to anon, authenticated
using (enabled = true);

drop policy if exists "public read map release registry" on public.espacios_map_release_registry;
create policy "public read map release registry"
on public.espacios_map_release_registry
for select
to anon, authenticated
using (true);
