-- Image Makeover Phase 1 schema
create extension if not exists pgcrypto;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Hair', 'Skin', 'Bridal', 'Nails')),
  description text not null default '',
  duration_minutes integer not null check (duration_minutes > 0),
  price numeric(10, 2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.gallery (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null check (category in ('Hair', 'Skin', 'Bridal', 'Nails')),
  image_url text not null,
  is_before_after boolean not null default false,
  before_image_url text,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  constraint gallery_before_image_required
    check (not is_before_after or before_image_url is not null)
);

create index if not exists services_active_category_idx
  on public.services (category, created_at desc) where is_active = true;
create index if not exists gallery_public_created_idx
  on public.gallery (created_at desc) where is_public = true;

alter table public.services enable row level security;
alter table public.gallery enable row level security;

-- Assign trusted staff the role with the Supabase Auth Admin API:
-- app_metadata: { "role": "admin" }. Never use user-editable user_metadata.
create policy "Public can read active services"
  on public.services for select
  using (is_active or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can insert services"
  on public.services for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can update services"
  on public.services for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can delete services"
  on public.services for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Public can read public gallery"
  on public.gallery for select
  using (is_public or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can insert gallery"
  on public.gallery for insert
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can update gallery"
  on public.gallery for update
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
create policy "Admins can delete gallery"
  on public.gallery for delete
  using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Storage setup: rerunnable bucket provisioning. Public buckets allow public
-- reads; write policies below are restricted to authenticated users.
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true), ('portfolio', 'portfolio', true)
on conflict (id) do update set public = excluded.public;

create policy "Public can view logos"
  on storage.objects for select
  using (bucket_id = 'logos');
create policy "Public can view portfolio"
  on storage.objects for select
  using (bucket_id = 'portfolio');
create policy "Authenticated users can upload portfolio images"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio');
create policy "Authenticated users can update portfolio images"
  on storage.objects for update to authenticated
  using (bucket_id = 'portfolio')
  with check (bucket_id = 'portfolio');
create policy "Authenticated users can delete portfolio images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio');
