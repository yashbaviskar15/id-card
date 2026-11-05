create extension if not exists pgcrypto;

create type public.access_scope as enum ('contact', 'full');

create table public.profiles (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[A-Za-z0-9_-]{12,}$'),
  full_name text not null default '',
  dob date,
  address text,
  photo_path text,
  show_dob boolean not null default false,
  show_address boolean not null default false,
  show_photo boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.prevent_profile_slug_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'profile slug is immutable' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger profiles_slug_immutable
before update on public.profiles
for each row execute function public.prevent_profile_slug_change();

create table public.fields (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('email', 'phone', 'address', 'other')),
  label text not null,
  value text not null,
  is_public boolean not null default false,
  sort integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(owner_id, name)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  storage_path text not null unique,
  mime text not null,
  size bigint not null check (size > 0 and size <= 52428800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  token_hash bytea not null unique,
  password_hash text,
  expires_at timestamptz not null,
  max_downloads integer check (max_downloads is null or max_downloads > 0),
  download_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.access_grants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  slug text not null references public.profiles(slug) on delete cascade,
  code_hash bytea not null,
  scope public.access_scope not null,
  expires_at timestamptz not null,
  used_at timestamptz,
  session_expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index access_grants_code_hash_unique
on public.access_grants(slug, code_hash);

create table public.access_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  grant_id uuid references public.access_grants(id) on delete set null,
  slug text not null,
  outcome text not null,
  ip_hash bytea,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  actor_type text not null check (actor_type in ('owner', 'visitor', 'system')),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.fields enable row level security;
alter table public.categories enable row level security;
alter table public.documents enable row level security;
alter table public.share_links enable row level security;
alter table public.access_grants enable row level security;
alter table public.access_log enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_owner on public.profiles for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy fields_owner on public.fields for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy categories_owner on public.categories for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy documents_owner on public.documents for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy share_links_owner on public.share_links for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy access_grants_owner on public.access_grants for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy access_log_owner_read on public.access_log for select to authenticated using (owner_id = auth.uid());
create policy audit_log_owner_read on public.audit_log for select to authenticated using (owner_id = auth.uid());

revoke all on public.profiles, public.fields, public.categories, public.documents,
  public.share_links, public.access_grants, public.access_log, public.audit_log
from anon;

do $$
begin
  if to_regprocedure('public.public_profile()') is not null then
    revoke all on function public.public_profile() from anon, authenticated;
  end if;
end;
$$;

create or replace function public.consume_access_grant(
  requested_slug text,
  requested_code_hash bytea
)
returns table(grant_id uuid, scope public.access_scope, session_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.access_grants
  set used_at = now(), session_expires_at = least(now() + interval '15 minutes', expires_at)
  where id = (
    select id
    from public.access_grants
    where slug = requested_slug
      and code_hash = requested_code_hash
      and used_at is null
      and revoked_at is null
      and expires_at > now()
    order by created_at desc
    for update skip locked
    limit 1
  )
  returning id, access_grants.scope, access_grants.session_expires_at;
end;
$$;

revoke all on function public.consume_access_grant(text, bytea) from anon, authenticated;

insert into storage.buckets (id, name, public)
values ('private-documents', 'private-documents', false)
on conflict (id) do nothing;

create policy private_documents_owner_select on storage.objects
for select to authenticated
using (bucket_id = 'private-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy private_documents_owner_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'private-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy private_documents_owner_update on storage.objects
for update to authenticated
using (bucket_id = 'private-documents' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'private-documents' and (storage.foldername(name))[1] = auth.uid()::text);

create policy private_documents_owner_delete on storage.objects
for delete to authenticated
using (bucket_id = 'private-documents' and (storage.foldername(name))[1] = auth.uid()::text);