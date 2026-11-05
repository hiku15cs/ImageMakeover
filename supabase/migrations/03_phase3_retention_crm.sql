-- Image Makeover Phase 3: customer retention, private lookbooks, and CRM.

alter table public.profiles
  add column if not exists total_spend numeric(10, 2) not null default 0.00
    check (total_spend >= 0),
  add column if not exists loyalty_visits integer not null default 0
    check (loyalty_visits >= 0),
  add column if not exists notes text,
  add column if not exists patch_test_date date;

alter table public.appointments
  add column if not exists amount_paid numeric(10, 2) not null default 0.00
    check (amount_paid >= 0);

alter table public.gallery
  add column if not exists customer_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gallery_customer_id_fkey'
      and conrelid = 'public.gallery'::regclass
  ) then
    alter table public.gallery
      add constraint gallery_customer_id_fkey
      foreign key (customer_id) references public.profiles (id) on delete set null;
  end if;
end
$$;

create index if not exists gallery_customer_created_idx
  on public.gallery (customer_id, created_at desc)
  where customer_id is not null;

create table if not exists public.customer_packages (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  total_sessions integer not null default 1 check (total_sessions between 1 and 100),
  used_sessions integer not null default 0
    check (used_sessions >= 0 and used_sessions <= total_sessions),
  purchased_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists customer_packages_customer_purchased_idx
  on public.customer_packages (customer_id, purchased_at desc);

alter table public.customer_packages enable row level security;

drop policy if exists "Customers read own packages" on public.customer_packages;
create policy "Customers read own packages"
  on public.customer_packages for select to authenticated
  using (customer_id = (select auth.uid()) or (select public.has_staff_access()));
drop policy if exists "Staff manage customer packages" on public.customer_packages;
create policy "Staff manage customer packages"
  on public.customer_packages for all to authenticated
  using ((select public.has_staff_access()))
  with check ((select public.has_staff_access()));

grant select, insert, update, delete on public.customer_packages to authenticated;
grant select, insert, update, delete on public.gallery to authenticated;
grant select on public.gallery to anon;
revoke select on public.profiles from authenticated;
grant select (id, full_name, phone, role, created_at, total_spend, loyalty_visits)
  on public.profiles to authenticated;
revoke update (notes, patch_test_date) on public.profiles from authenticated;

drop policy if exists "Public can read public gallery" on public.gallery;
drop policy if exists "Customers can read own lookbook" on public.gallery;
create policy "Public can read public gallery"
  on public.gallery for select
  using (
    is_public
    or customer_id = (select auth.uid())
    or (select public.has_staff_access())
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'customer-lookbooks',
  'customer-lookbooks',
  false,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Customers and staff can read lookbook files" on storage.objects;
create policy "Customers and staff can read lookbook files"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'customer-lookbooks'
    and (
      (select public.has_staff_access())
      or (storage.foldername(name))[1] = (select auth.uid())::text
    )
  );
drop policy if exists "Staff can upload lookbook files" on storage.objects;
create policy "Staff can upload lookbook files"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'customer-lookbooks'
    and (select public.has_staff_access())
  );
drop policy if exists "Staff can update lookbook files" on storage.objects;
create policy "Staff can update lookbook files"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'customer-lookbooks'
    and (select public.has_staff_access())
  )
  with check (
    bucket_id = 'customer-lookbooks'
    and (select public.has_staff_access())
  );
drop policy if exists "Staff can delete lookbook files" on storage.objects;
create policy "Staff can delete lookbook files"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'customer-lookbooks'
    and (select public.has_staff_access())
  );

-- Existing completed visits are included so Phase 3 starts with accurate totals.
update public.appointments a
set amount_paid = s.price
from public.services s
where a.service_id = s.id
  and a.status = 'completed'
  and a.amount_paid = 0;

with completed_visits as (
  select
    a.customer_id,
    count(*)::integer as visit_count,
    coalesce(sum(a.amount_paid), 0)::numeric(10, 2) as spend
  from public.appointments a
  where a.customer_id is not null
    and a.status = 'completed'
  group by a.customer_id
)
update public.profiles p
set loyalty_visits = completed_visits.visit_count,
    total_spend = completed_visits.spend
from completed_visits
where p.id = completed_visits.customer_id;

create or replace function public.guard_customer_appointment_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('app.profile_delete', true) = old.customer_id::text then
    return new;
  end if;
  if public.has_staff_access() then
    return new;
  end if;
  if old.customer_id = auth.uid()
    and old.scheduled_at > now() + interval '4 hours'
    and old.status in ('pending', 'confirmed')
    and new.id = old.id
    and new.customer_id = old.customer_id
    and new.guest_name is not distinct from old.guest_name
    and new.guest_phone is not distinct from old.guest_phone
    and new.service_id = old.service_id
    and new.duration_minutes = old.duration_minutes
    and new.staff_notes is not distinct from old.staff_notes
    and new.amount_paid = old.amount_paid
    and new.created_at = old.created_at
    and (
      (
        new.status = 'cancelled'
        and new.scheduled_at = old.scheduled_at
      )
      or (
        new.status = old.status
        and new.scheduled_at <> old.scheduled_at
        and new.scheduled_at > now()
      )
    ) then
    return new;
  end if;
  raise exception 'Customers may only cancel or reschedule their own appointment more than four hours in advance';
end;
$$;

create or replace function public.set_completed_appointment_amount()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount numeric(10, 2);
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    select s.price into v_amount
    from public.services s
    where s.id = new.service_id;
    if v_amount is null then
      raise exception 'Could not determine appointment service price';
    end if;
    new.amount_paid := v_amount;
  end if;
  return new;
end;
$$;

drop trigger if exists set_completed_appointment_amount on public.appointments;
create trigger set_completed_appointment_amount
  before update of status on public.appointments
  for each row execute procedure public.set_completed_appointment_amount();

create or replace function public.apply_completed_visit_loyalty()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed'
    and old.status is distinct from 'completed'
    and new.customer_id is not null then
    update public.profiles p
    set loyalty_visits = p.loyalty_visits + 1,
        total_spend = p.total_spend + new.amount_paid
    where p.id = new.customer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists apply_completed_visit_loyalty on public.appointments;
create trigger apply_completed_visit_loyalty
  after update of status on public.appointments
  for each row execute procedure public.apply_completed_visit_loyalty();

create or replace function public.reschedule_customer_appointment(
  p_appointment_id uuid,
  p_scheduled_at timestamptz
)
returns public.appointments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := auth.uid();
  v_appointment public.appointments%rowtype;
  v_service public.services%rowtype;
  v_local timestamp;
  v_local_date date;
  v_capacity integer;
  v_max_advance integer;
  v_booked integer;
begin
  if v_customer_id is null then
    raise exception 'Sign in to reschedule an appointment';
  end if;
  if p_scheduled_at is null then
    raise exception 'Choose a valid appointment time';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_customer_id and p.role = 'customer'::public.user_role
  ) then
    raise exception 'Only customer accounts can reschedule customer appointments';
  end if;

  select * into v_appointment
  from public.appointments a
  where a.id = p_appointment_id
    and a.customer_id = v_customer_id
  for update;
  if not found then
    raise exception 'Appointment not found';
  end if;
  if v_appointment.scheduled_at <= now() + interval '4 hours'
    or v_appointment.status not in ('pending', 'confirmed') then
    raise exception 'Appointments can only be rescheduled more than four hours in advance while pending or confirmed';
  end if;
  if p_scheduled_at <= now() then
    raise exception 'Choose a future appointment time';
  end if;

  select * into v_service
  from public.services s
  where s.id = v_appointment.service_id;
  if not found then
    raise exception 'The appointment service could not be found';
  end if;

  v_local := p_scheduled_at at time zone 'Asia/Kolkata';
  v_local_date := v_local::date;
  if extract(isodow from v_local_date) = 2 then
    raise exception 'The salon is closed on Tuesdays';
  end if;
  if v_local::time < time '10:00'
    or v_local::time >= time '20:00'
    or extract(minute from v_local)::integer not in (0, 30)
    or extract(second from v_local) <> 0 then
    raise exception 'Choose a 30-minute slot between 10:00 AM and 7:30 PM IST';
  end if;
  if v_local + make_interval(mins => v_service.duration_minutes) > v_local_date + time '20:30' then
    raise exception 'The service must finish by 8:30 PM IST';
  end if;

  select s.max_parallel_appointments, s.max_advance_days
    into v_capacity, v_max_advance
  from public.salon_settings s where s.id = true;
  v_capacity := coalesce(v_capacity, 3);
  v_max_advance := coalesce(v_max_advance, 30);
  if v_local_date > (now() at time zone 'Asia/Kolkata')::date + v_max_advance then
    raise exception 'Choose a date within the next % days', v_max_advance;
  end if;

  perform pg_advisory_xact_lock(hashtext('appointments:' || v_local_date::text));
  select count(*)::integer into v_booked
  from public.appointments a
  where a.id <> v_appointment.id
    and a.status in ('pending', 'confirmed', 'in_chair')
    and a.scheduled_at < p_scheduled_at + make_interval(mins => v_service.duration_minutes)
    and a.scheduled_at + make_interval(mins => a.duration_minutes) > p_scheduled_at;
  if v_booked >= v_capacity then
    raise exception 'This time slot just filled. Please choose another time.';
  end if;

  update public.appointments a
  set scheduled_at = p_scheduled_at
  where a.id = v_appointment.id
  returning * into v_appointment;
  return v_appointment;
end;
$$;

create or replace function public.adjust_customer_package_sessions(
  p_package_id uuid,
  p_delta integer
)
returns public.customer_packages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_package public.customer_packages%rowtype;
begin
  if not public.has_staff_access() then
    raise exception 'Staff access required';
  end if;
  if p_delta is null or p_delta not in (-1, 1) then
    raise exception 'Package adjustments must be one session at a time';
  end if;

  select * into v_package
  from public.customer_packages cp
  where cp.id = p_package_id
  for update;
  if not found then
    raise exception 'Package not found';
  end if;
  if v_package.used_sessions + p_delta < 0
    or v_package.used_sessions + p_delta > v_package.total_sessions then
    raise exception 'Package session balance cannot go below zero or above the purchased total';
  end if;

  update public.customer_packages cp
  set used_sessions = cp.used_sessions + p_delta
  where cp.id = p_package_id
  returning * into v_package;
  return v_package;
end;
$$;

create or replace function public.get_crm_customer_notes(p_customer_id uuid)
returns table (notes text, patch_test_date date)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_access() then
    raise exception 'Staff access required';
  end if;
  return query
    select p.notes, p.patch_test_date
    from public.profiles p
    where p.id = p_customer_id
      and p.role = 'customer'::public.user_role;
end;
$$;

create or replace function public.update_crm_customer_notes(
  p_customer_id uuid,
  p_notes text,
  p_patch_test_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_access() then
    raise exception 'Staff access required';
  end if;
  if char_length(coalesce(p_notes, '')) > 10000 then
    raise exception 'Notes must be 10,000 characters or fewer';
  end if;
  update public.profiles p
  set notes = nullif(trim(p_notes), ''),
      patch_test_date = p_patch_test_date
  where p.id = p_customer_id
    and p.role = 'customer'::public.user_role;
  if not found then
    raise exception 'Client profile not found';
  end if;
end;
$$;

create or replace function public.get_crm_customer_directory()
returns table (
  id uuid,
  full_name text,
  phone text,
  total_spend numeric,
  loyalty_visits integer,
  visit_count bigint,
  last_visit timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.has_staff_access() then
    raise exception 'Staff access required';
  end if;
  return query
    select p.id, p.full_name, p.phone, p.total_spend, p.loyalty_visits,
      count(a.id)::bigint, max(a.scheduled_at)
    from public.profiles p
    left join public.appointments a
      on a.customer_id = p.id and a.status = 'completed'
    where p.role = 'customer'::public.user_role
    group by p.id
    order by p.full_name nulls last, p.created_at desc;
end;
$$;

create or replace function public.get_crm_business_metrics()
returns table (
  monthly_appointments bigint,
  repeat_customer_retention numeric,
  top_service_title text,
  top_service_appointments bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month_start timestamptz := date_trunc('month', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata';
  v_month_end timestamptz := (date_trunc('month', now() at time zone 'Asia/Kolkata') + interval '1 month') at time zone 'Asia/Kolkata';
  v_monthly bigint;
  v_retention numeric;
  v_service text;
  v_service_count bigint;
begin
  if not public.has_staff_access() then
    raise exception 'Staff access required';
  end if;

  select count(*)::bigint into v_monthly
  from public.appointments a
  where a.scheduled_at >= v_month_start and a.scheduled_at < v_month_end;

  with visits as (
    select a.customer_id, count(*) as visit_count
    from public.appointments a
    where a.customer_id is not null and a.status = 'completed'
    group by a.customer_id
  )
  select coalesce(
    round(100.0 * count(*) filter (where visits.visit_count > 1)
      / nullif(count(*), 0), 1),
    0
  ) into v_retention
  from visits;

  select s.title, count(*)::bigint into v_service, v_service_count
  from public.appointments a
  join public.services s on s.id = a.service_id
  where a.status = 'completed'
    and a.scheduled_at >= v_month_start
    and a.scheduled_at < v_month_end
  group by s.id, s.title
  order by count(*) desc, s.title
  limit 1;

  return query select v_monthly, coalesce(v_retention, 0), v_service, coalesce(v_service_count, 0);
end;
$$;

revoke all on function public.reschedule_customer_appointment(uuid, timestamptz) from public, anon;
grant execute on function public.reschedule_customer_appointment(uuid, timestamptz) to authenticated;
revoke all on function public.adjust_customer_package_sessions(uuid, integer) from public, anon;
grant execute on function public.adjust_customer_package_sessions(uuid, integer) to authenticated;
revoke all on function public.get_crm_customer_notes(uuid) from public, anon;
grant execute on function public.get_crm_customer_notes(uuid) to authenticated;
revoke all on function public.update_crm_customer_notes(uuid, text, date) from public, anon;
grant execute on function public.update_crm_customer_notes(uuid, text, date) to authenticated;
revoke all on function public.get_crm_customer_directory() from public, anon;
grant execute on function public.get_crm_customer_directory() to authenticated;
revoke all on function public.get_crm_business_metrics() from public, anon;
grant execute on function public.get_crm_business_metrics() to authenticated;

comment on table public.customer_packages is
  'Staff-managed prepaid session passes. Customers can read their own package balances.';
comment on column public.gallery.customer_id is
  'When set, the image is assigned to that customer’s private lookbook unless is_public is true.';
comment on column public.profiles.notes is
  'Private operational notes for staff only; never expose through customer-facing queries.';
comment on column public.profiles.loyalty_visits is
  'Completed customer appointments; the fifth visit earns a loyalty reward.';
